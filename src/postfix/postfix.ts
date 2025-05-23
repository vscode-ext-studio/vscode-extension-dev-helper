import * as vsc from 'vscode'
import { PostfixCompletionProvider } from './postfixCompletionProvider'
import { notCommand, NOT_COMMAND } from './notCommand'
import { activateColorCompletions } from './css-theme-completions'

let completionProvider: vsc.Disposable

export function activatePostfix(context: vsc.ExtensionContext): void {
    activateColorCompletions(context)
    registerCompletionProvider(context)

    context.subscriptions.push(vsc.commands.registerTextEditorCommand(NOT_COMMAND, async (editor: vsc.TextEditor, _: vsc.TextEditorEdit, ...args: any[]) => {
        const [...expressions] = args
        await notCommand(editor, expressions)
    }))

    context.subscriptions.push(vsc.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('postfix')) {
            return
        }

        if (completionProvider) {
            const idx = context.subscriptions.indexOf(completionProvider)
            context.subscriptions.splice(idx, 1)
            completionProvider.dispose()
        }

        registerCompletionProvider(context)
    }))
}

function registerCompletionProvider(context: vsc.ExtensionContext) {
    const provider = new PostfixCompletionProvider()

    const TESTS_SELECTOR: vsc.DocumentSelector = ['postfix', 'html']
    const DOCUMENT_SELECTOR: vsc.DocumentSelector =
        process.env.NODE_ENV === 'test' ? TESTS_SELECTOR : <string[]>vsc.workspace.getConfiguration('postfix').get('languages')

    completionProvider = vsc.languages.registerCompletionItemProvider(DOCUMENT_SELECTOR, provider, '.')
    context.subscriptions.push(completionProvider)
} 