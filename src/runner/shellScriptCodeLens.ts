import { CodeLens, CodeLensProvider, ExtensionContext, languages, Range, TextDocument } from 'vscode'

const shellScriptSelector = { language: 'shellscript' }

class ShellScriptCodeLensProvider implements CodeLensProvider {
    provideCodeLenses(document: TextDocument): CodeLens[] {
        const range = new Range(0, 0, 0, 0)
        return [
            new CodeLens(range, {
                title: '$(run) Run',
                command: 'extension.runFile',
                arguments: [document.uri],
            }),
        ]
    }
}

export function activateShellScriptCodeLens(context: ExtensionContext) {
    if (process.platform === 'win32') {
        return
    }
    context.subscriptions.push(
        languages.registerCodeLensProvider(shellScriptSelector, new ShellScriptCodeLensProvider()),
    )
}
