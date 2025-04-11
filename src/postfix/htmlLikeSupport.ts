import * as vsc from 'vscode'

export const getHtmlLikeEmbedText = (document: vsc.TextDocument, cursorOffset: number): string | null => {
  const text = document.getText()

  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/g
  let match: RegExpExecArray | null
  let scriptContent: string | null = null
  let contentStart = 0
  let contentEnd = 0

  while ((match = scriptRegex.exec(text)) !== null) {
    const startOffset = document.offsetAt(document.positionAt(match.index))
    const endOffset = startOffset + match[0].length
    contentStart = startOffset + match[0].indexOf('>') + 1
    contentEnd = endOffset - '</script>'.length

    if (cursorOffset >= contentStart && cursorOffset <= contentEnd) {
      scriptContent = match[1]
      break
    }
  }

  if (!scriptContent) {
    return null
  }

  return text.slice(0, contentStart).replaceAll(/[^\n]/g, ' ') +
    scriptContent +
    text.slice(contentEnd).replaceAll(/[^\n]/g, ' ')
}
