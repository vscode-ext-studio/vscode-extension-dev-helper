import { Range, TextDocument } from 'vscode'
import { VueBlock } from './vueBlockParser'

export interface ClassToken {
  name: string
  range: Range
}

const CLASS_ATTR_REGEX = /(?:^|\s)(:class|class)\s*=\s*(["'])([\s\S]*?)\2/gm
const CLASS_NAME_PATTERN = /[a-zA-Z_][\w-]*/g
const DYNAMIC_CLASS_KEY_REGEX = /(?:^|[,{]\s*)(?:['"]([\w-]+)['"]|([\w-]+))\s*:/g
const DYNAMIC_CLASS_STRING_REGEX = /['"]([\w-]+)['"]/g
const STYLE_CLASS_REGEX = /\.([a-zA-Z_][\w-]*)/g

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addClassTokensFromStaticValue(
  value: string,
  valueStart: number,
  document: TextDocument,
  tokens: ClassToken[],
): void {
  let match: RegExpExecArray | null
  CLASS_NAME_PATTERN.lastIndex = 0
  while ((match = CLASS_NAME_PATTERN.exec(value)) !== null) {
    const start = valueStart + match.index
    const end = start + match[0].length
    tokens.push({
      name: match[0],
      range: new Range(document.positionAt(start), document.positionAt(end)),
    })
  }
}

function addClassTokensFromDynamicValue(
  value: string,
  valueStart: number,
  document: TextDocument,
  tokens: ClassToken[],
): void {
  const trimmed = value.trim()
  if (trimmed.startsWith('{')) {
    let match: RegExpExecArray | null
    DYNAMIC_CLASS_KEY_REGEX.lastIndex = 0
    while ((match = DYNAMIC_CLASS_KEY_REGEX.exec(value)) !== null) {
      const name = match[1] ?? match[2]
      const keyStart = match.index + match[0].indexOf(name)
      const start = valueStart + keyStart
      const end = start + name.length
      tokens.push({
        name,
        range: new Range(document.positionAt(start), document.positionAt(end)),
      })
    }
    return
  }

  let match: RegExpExecArray | null
  DYNAMIC_CLASS_STRING_REGEX.lastIndex = 0
  while ((match = DYNAMIC_CLASS_STRING_REGEX.exec(value)) !== null) {
    const name = match[1]
    const start = valueStart + match.index + 1
    const end = start + name.length
    tokens.push({
      name,
      range: new Range(document.positionAt(start), document.positionAt(end)),
    })
  }
}

function collectClassTokensInAttributeValue(
  attrName: string,
  value: string,
  valueStart: number,
  document: TextDocument,
): ClassToken[] {
  const tokens: ClassToken[] = []
  if (attrName === 'class') {
    addClassTokensFromStaticValue(value, valueStart, document, tokens)
    return tokens
  }

  const trimmed = value.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    addClassTokensFromDynamicValue(value, valueStart, document, tokens)
    return tokens
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    addClassTokensFromStaticValue(trimmed.slice(1, -1), valueStart + 1, document, tokens)
    return tokens
  }

  addClassTokensFromStaticValue(value, valueStart, document, tokens)
  return tokens
}

function collectClassTokensInBlock(
  document: TextDocument,
  block: VueBlock,
): ClassToken[] {
  const blockText = document.getText().slice(block.contentStart, block.contentEnd)
  const tokens: ClassToken[] = []
  let match: RegExpExecArray | null
  CLASS_ATTR_REGEX.lastIndex = 0
  while ((match = CLASS_ATTR_REGEX.exec(blockText)) !== null) {
    const attrName = match[1]
    const value = match[3]
    const valueStart = block.contentStart + match.index + match[0].indexOf(value)
    const attrTokens = collectClassTokensInAttributeValue(attrName, value, valueStart, document)
    for (const token of attrTokens) {
      tokens.push(token)
    }
  }
  return tokens
}

export function findClassAtCursorInTemplate(
  document: TextDocument,
  offset: number,
  block: VueBlock,
): ClassToken | undefined {
  const tokens = collectClassTokensInBlock(document, block)
  for (const token of tokens) {
    const tokenStart = document.offsetAt(token.range.start)
    const tokenEnd = document.offsetAt(token.range.end)
    if (offset >= tokenStart && offset <= tokenEnd) {
      return token
    }
  }
  return undefined
}

export function findClassAtCursorInStyle(
  document: TextDocument,
  offset: number,
  block: VueBlock,
): ClassToken | undefined {
  if (offset < block.contentStart || offset >= block.contentEnd) {
    return undefined
  }

  const blockText = document.getText().slice(block.contentStart, block.contentEnd)
  const relOffset = offset - block.contentStart
  const lineStart = blockText.lastIndexOf('\n', relOffset - 1) + 1
  const nextLineBreak = blockText.indexOf('\n', relOffset)
  const lineEnd = nextLineBreak === -1 ? blockText.length : nextLineBreak
  const line = blockText.slice(lineStart, lineEnd)
  const lineOffset = block.contentStart + lineStart

  let match: RegExpExecArray | null
  STYLE_CLASS_REGEX.lastIndex = 0
  while ((match = STYLE_CLASS_REGEX.exec(line)) !== null) {
    const name = match[1]
    const tokenStart = lineOffset + match.index
    const tokenEnd = tokenStart + 1 + name.length
    if (offset >= tokenStart && offset <= tokenEnd) {
      return {
        name,
        range: new Range(
          document.positionAt(tokenStart),
          document.positionAt(tokenEnd),
        ),
      }
    }
  }
  return undefined
}

export function findClassSelectorInStyle(
  document: TextDocument,
  className: string,
  block: VueBlock,
): ClassToken | undefined {
  const text = document.getText().slice(block.contentStart, block.contentEnd)
  const regex = new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const start = block.contentStart + match.index
    const end = start + match[0].length
    return {
      name: className,
      range: new Range(document.positionAt(start), document.positionAt(end)),
    }
  }
  return undefined
}

export function findClassUsagesInTemplate(
  document: TextDocument,
  className: string,
  block: VueBlock,
): ClassToken[] {
  const tokens = collectClassTokensInBlock(document, block)
  const usages: ClassToken[] = []
  for (const token of tokens) {
    if (token.name === className) {
      usages.push(token)
    }
  }
  return usages
}
