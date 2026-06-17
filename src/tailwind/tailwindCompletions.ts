import {
  CancellationToken,
  CompletionContext,
  CompletionList,
  ExtensionContext,
  languages,
  Position,
  TextDocument,
} from 'vscode'
import { getClassListContext } from './classContext'
import { completionsFromClassList } from './completions'

const DOCUMENT_SELECTOR = [
  { language: 'html' },
  { language: 'vue' },
  { language: 'svelte' },
  { language: 'javascript' },
  { language: 'typescript' },
  { language: 'javascriptreact' },
  { language: 'typescriptreact' },
  { language: 'css' },
  { language: 'less' },
  { language: 'scss' },
  { language: 'sass' },
  { language: 'stylus' },
]

const TRIGGER_CHARACTERS = [' ', '"', "'", '`', ':', '-', '!', '/']

export function activateTailwindCompletions(context: ExtensionContext): void {
  const provider = languages.registerCompletionItemProvider(
    DOCUMENT_SELECTOR,
    {
      provideCompletionItems(
        document: TextDocument,
        position: Position,
        _context: CompletionContext,
        _token: CancellationToken,
      ): CompletionList | undefined {
        const classContext = getClassListContext(document, position)
        if (!classContext) {
          return undefined
        }

        const items = completionsFromClassList({
          classList: classContext.classList,
          position,
        })

        if (items.length === 0) {
          return undefined
        }

        return new CompletionList(items, false)
      },
    },
    ...TRIGGER_CHARACTERS,
  )

  context.subscriptions.push(provider)
}
