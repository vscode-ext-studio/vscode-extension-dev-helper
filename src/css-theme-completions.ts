import {
  ExtensionContext, workspace, languages, TextDocument,
  Position, CompletionItem, CompletionItemKind, Uri
} from 'vscode'

const enum Constants {
  VarPrefix = 'var(',
  ThemeVarPrefix = '--vscode-',
}

interface IColorData {
  key: string
  description: string | null
}

export function activateColorCompletions(context: ExtensionContext): void {
  let cachedColors: IColorData[] | undefined

  const retrieveColors = async () => {
    if (!cachedColors) {
      try {
        const doc = await workspace.openTextDocument(Uri.parse('vscode://schemas/workbench-colors'))
        const contents = JSON.parse(doc.getText())
        cachedColors = Object.entries(contents.properties)
          .map(([key, value]) => ({
            description: (value as { description: string }).description,
            key: key.replace(/\./g, '-'),
          }))
      } catch (e) {
        cachedColors = []
        console.error('error fetching updated vscode theme colors:', e)
      }
    }
    return cachedColors
  }

  /**
   * Completion provider for colors.
   */
  const provider = languages.registerCompletionItemProvider(
    [
      { language: 'css' }, { language: 'less' }, { language: 'scss' },
      { language: 'stylus' }, { language: 'sass' }, { language: 'html' }, { language: 'svelte' },
      { language: 'vue' },
    ],
    {
      async provideCompletionItems(document: TextDocument, position: Position) {
        const lineText = document.lineAt(position).text

        let inVarFunction = false
        let prefix = ''

        let openParenIndex = -1
        for (let i = position.character - 1; i >= 0; i--) {
          if (lineText[i] === '(') {
            const varStart = i - 3
            if (varStart >= 0 && lineText.substring(varStart, i) === 'var') {
              openParenIndex = i
              inVarFunction = true
              break
            }
          }
        }

        if (!inVarFunction) {
          return undefined
        }

        const textAfterCursor = lineText.substring(position.character)
        const closeParenMatch = /^[^)]*\)/.exec(textAfterCursor)

        if (!closeParenMatch) {
          return undefined
        }

        prefix = lineText.substring(openParenIndex + 1, position.character).trim()

        const colors = await retrieveColors()
        if (!colors || colors.length === 0) {
          return []
        }

        return colors
          .filter(color => {
            const fullName = Constants.ThemeVarPrefix + color.key
            return !prefix || fullName.startsWith(prefix)
          })
          .map(color => {
            const fullName = Constants.ThemeVarPrefix + color.key
            const item = new CompletionItem(fullName, CompletionItemKind.Constant)
            item.detail = color.description
            item.sortText = 'z'
            return item
          })
      },
    },
    '(',
  )
  context.subscriptions.push(provider)
}
