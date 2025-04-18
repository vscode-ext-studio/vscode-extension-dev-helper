import * as vsc from 'vscode'
import * as ts from 'typescript'

import { IndentInfo, IPostfixTemplate } from './template'
import { AllTabs, AllSpaces } from './utils/multiline-expressions'
import { loadBuiltinTemplates } from './utils/templates'
import { findNodeAtPosition } from './utils/typescript'
import { getHtmlLikeEmbedText } from './htmlLikeSupport'

let currentSuggestion = undefined

export const overrideTsxEnabled = { value: false }

export class PostfixCompletionProvider implements vsc.CompletionItemProvider {
  private templates: IPostfixTemplate[] = []

  constructor() {
    this.templates = [
      ...loadBuiltinTemplates(),
    ]
  }

  provideCompletionItems(document: vsc.TextDocument, position: vsc.Position, _token: vsc.CancellationToken): vsc.CompletionItem[] | vsc.CompletionList | Thenable<vsc.CompletionItem[] | vsc.CompletionList> {
    const line = document.lineAt(position.line)
    const dotIdx = line.text.lastIndexOf('.', position.character - 1)
    const wordRange = document.getWordRangeAtPosition(position)
    const isCursorOnWordAfterDot = (wordRange?.start ?? position).character === dotIdx + 1

    if (dotIdx === -1 || !isCursorOnWordAfterDot) {
      return []
    }

    const { currentNode, fullSource, fullCurrentNode } = this.getNodeBeforeTheDot(document, position, dotIdx)

    if (!currentNode || this.shouldBeIgnored(fullSource, position)) {
      return []
    }

    const indentInfo = this.getIndentInfo(document, currentNode)
    const node = this.isTypeReference(fullCurrentNode) ? fullCurrentNode : currentNode
    const replacementNode = this.getNodeForReplacement(node)

    try {
      return this.templates
        .filter(t => {
          const canUseTemplate = t.canUse(ts.isNonNullExpression(node) ? node.expression : node)
          return canUseTemplate
        })
        .flatMap(t => t.buildCompletionItem(replacementNode, indentInfo))
    } catch (err) {
      console.error('Error while building postfix autocomplete items:')
      console.error(err)

      return []
    }
  }

  resolveCompletionItem(item: vsc.CompletionItem, _token: vsc.CancellationToken): vsc.ProviderResult<vsc.CompletionItem> {
    currentSuggestion = (item.label as vsc.CompletionItemLabel)?.label || item.label
    return item
  }

  private isTypeReference = (node: ts.Node) => {
    const typeRef = ts.findAncestor(node, ts.isTypeReferenceNode)
    return !!typeRef
  }

  private getNodeForReplacement = (node: ts.Node) => {
    if (ts.isTemplateSpan(node)) {
      return node.parent
    }

    if (ts.isPrefixUnaryExpression(node.parent) || ts.isPropertyAccessExpression(node.parent)) {
      return node.parent
    }

    if (ts.isQualifiedName(node.parent)) {
      const typeRef = ts.findAncestor(node, ts.isTypeReferenceNode)

      if (ts.isQualifiedName(typeRef.typeName)) {
        return typeRef.typeName.left
      }

      return typeRef
    }

    return node
  }

  private getHtmlLikeEmbeddedText(document: vsc.TextDocument, position: vsc.Position) {
    const knownHtmlLikeLangs = [
      'html',
      'vue',
      'svelte'
    ]

    if (knownHtmlLikeLangs.includes(document.languageId)) {
      return getHtmlLikeEmbedText(document, document.offsetAt(position))
    }

    return undefined
  }

  private getNodeBeforeTheDot(document: vsc.TextDocument, position: vsc.Position, dotIdx: number) {
    const dotOffset = document.offsetAt(position.with({ character: dotIdx }))
    const speciallyHandledText = this.getHtmlLikeEmbeddedText(document, position)

    if (speciallyHandledText === null) {
      return {}
    }

    const fullText = speciallyHandledText ?? document.getText()
    const codeBeforeTheDot = fullText.slice(0, dotOffset)

    const scriptKind = this.convertToScriptKind(document)
    const source = ts.createSourceFile('test.ts', codeBeforeTheDot, ts.ScriptTarget.ESNext, true, scriptKind)
    const fullSource = ts.createSourceFile('test.ts', fullText, ts.ScriptTarget.ESNext, true, scriptKind)

    const typedTemplate = document.getText(document.getWordRangeAtPosition(position))

    const findNormalizedNode = (source: ts.SourceFile) => {
      const beforeTheDotPosition = ts.getPositionOfLineAndCharacter(source, position.line, dotIdx - 1)
      let node = findNodeAtPosition(source, beforeTheDotPosition)
      if (node && ts.isIdentifier(node) && ts.isPropertyAccessExpression(node.parent)
        && (node.parent.name.text != typedTemplate || ts.isPrefixUnaryExpression(node.parent.parent))) {
        node = node.parent
      }
      return node
    }

    return { currentNode: findNormalizedNode(source), fullSource, fullCurrentNode: findNormalizedNode(fullSource) }
  }

  private convertToScriptKind(document: vsc.TextDocument) {
    if (overrideTsxEnabled.value) {
      return ts.ScriptKind.TSX
    }
    switch (document.languageId) {
      case 'javascript':
        return ts.ScriptKind.JS
      case 'typescript':
        return ts.ScriptKind.TS
      case 'javascriptreact':
        return ts.ScriptKind.JSX
      case 'typescriptreact':
        return ts.ScriptKind.TSX
      default:
        return ts.ScriptKind.Unknown
    }
  }

  private getIndentInfo(document: vsc.TextDocument, node: ts.Node): IndentInfo {
    const source = node.getSourceFile()
    const position = ts.getLineAndCharacterOfPosition(source, node.getStart(source))

    const line = document.lineAt(position.line)
    const whitespaces = line.text.substring(0, line.firstNonWhitespaceCharacterIndex)
    let indentSize = 0

    if (AllTabs.test(whitespaces)) {
      indentSize = whitespaces.length
    } else if (AllSpaces.test(whitespaces)) {
      indentSize = whitespaces.length / (vsc.window.activeTextEditor.options.tabSize as number)
    }

    return {
      indentSize,
      leadingWhitespace: whitespaces
    }
  }

  private shouldBeIgnored(fullSource: ts.SourceFile, position: vsc.Position) {
    const pos = fullSource.getPositionOfLineAndCharacter(position.line, position.character)
    const node = findNodeAtPosition(fullSource, pos)

    return node && (isComment(node) || isJsx(node))

    function isComment(node: ts.Node) {
      return [
        ts.SyntaxKind.JSDocComment,
        ts.SyntaxKind.JSDoc,
        ts.SyntaxKind.MultiLineCommentTrivia,
        ts.SyntaxKind.SingleLineCommentTrivia
      ].includes(node.kind)
    }

    function isJsx(node: ts.Node) {
      const jsx = ts.findAncestor(node, ts.isJsxElement)
      const jsxFragment = ts.findAncestor(node, ts.isJsxFragment)
      const jsxExpression = ts.findAncestor(node, ts.isJsxExpression)

      return (!!jsx || !!jsxFragment) && !jsxExpression
    }
  }
}

export const getCurrentSuggestion = () => currentSuggestion
export const resetCurrentSuggestion = () => currentSuggestion = undefined
