import { Position, TextDocument } from 'vscode'
import { segment } from './segment'

const SEARCH_RANGE = 2000
const CLASS_ATTRIBUTES = ['class', 'className', 'ngClass', 'class:list']
const CLASS_SEPARATOR = ':'

export interface ClassListContext {
  classList: string
}

function findAll(re: RegExp, str: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const regex = new RegExp(re.source, flags)
  while ((match = regex.exec(str)) !== null) {
    matches.push(match)
  }
  return matches
}

function matchClassAttributes(text: string): RegExpMatchArray[] {
  const attrs = CLASS_ATTRIBUTES.flatMap((name) => [name, `\\[${name}\\]`])
  const re = new RegExp(`(?:\\s|:|\\()(${attrs.join('|')})\\s*=\\s*['"\`{]`, 'gi')
  return findAll(re, text)
}

function findClosingQuoteIndex(value: string, quote: string): number {
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\') {
      i++
      continue
    }
    if (value[i] === quote) {
      return i
    }
  }
  return -1
}

function extractQuotedClassList(text: string, match: RegExpMatchArray): string | undefined {
  const openQuote = match[0].slice(-1)
  const valueStart = match.index! + match[0].length
  const valuePart = text.slice(valueStart)
  if (findClosingQuoteIndex(valuePart, openQuote) !== -1) {
    return undefined
  }
  return valuePart
}

function getAtApplyClassList(text: string): string | undefined {
  const matches = findAll(/@apply\s+([^;{}]*)$/gi, text)
  if (matches.length === 0) {
    return undefined
  }
  return matches[matches.length - 1][1]
}

export function getClassListContext(
  document: TextDocument,
  position: Position,
): ClassListContext | undefined {
  const offset = document.offsetAt(position)
  const searchStart = Math.max(0, offset - SEARCH_RANGE)
  const text = document.getText().slice(searchStart, offset)

  const applyClassList = getAtApplyClassList(text)
  if (applyClassList !== undefined) {
    return { classList: applyClassList }
  }

  const matches = matchClassAttributes(text)
  if (matches.length === 0) {
    return undefined
  }

  const match = matches[matches.length - 1]
  const classList = extractQuotedClassList(text, match)
  if (classList === undefined) {
    return undefined
  }

  return { classList }
}

export function getVariantsFromClassName(
  className: string,
  variantNames: ReadonlySet<string>,
): { variants: string[]; offset: number } {
  const parts = segment(className, CLASS_SEPARATOR)
  if (parts.length < 2) {
    return { variants: [], offset: 0 }
  }

  const variants: string[] = []
  let offset = 0

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (part === '') {
      break
    }

    const isArbitrary = part.startsWith('[') && part.endsWith(']')
    if (!variantNames.has(part) && !isArbitrary) {
      break
    }

    variants.push(part)
    offset += part.length
    offset += index < parts.length - 1 ? CLASS_SEPARATOR.length : 0
  }

  return { variants, offset }
}
