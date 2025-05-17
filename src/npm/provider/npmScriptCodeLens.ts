import * as vscode from 'vscode';
import { selector } from '../npmCheckCommon';

export class NpmScriptCodeLensProvider implements vscode.CodeLensProvider {
    private regex: RegExp = /"scripts"\s*:\s*{([^}]*})/;

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        const text = document.getText();
        const matches = this.regex.exec(text);

        if (matches) {
            const scriptsObj = JSON.parse(`{${matches[1]}`);
            const scripts = Object.keys(scriptsObj);

            for (const script of scripts) {
                const pattern = new RegExp(`"${script}"\\s*:\\s*"`);
                const match = pattern.exec(text);
                if (match) {
                    const position = document.positionAt(match.index);
                    const range = new vscode.Range(position, position);

                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `$(run) ${script}`,
                        command: 'extension.npm.runScript',
                        arguments: [script]
                    }));
                }
            }
        }

        return codeLenses;
    }
}

export function activateNpmScriptCodeLens(context: vscode.ExtensionContext) {
    const provider = new NpmScriptCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(selector, provider),
        vscode.commands.registerCommand('extension.npm.runScript', (script: string) => {
            const terminal = vscode.window.createTerminal('NPM Script');
            terminal.sendText(`npm run ${script}`);
            terminal.show();
        })
    );
}
