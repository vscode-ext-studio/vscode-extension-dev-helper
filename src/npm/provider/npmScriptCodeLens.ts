import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { selector } from '../npmCheckCommon';

export class NpmScriptCodeLensProvider implements vscode.CodeLensProvider {
    private regex: RegExp = /"scripts"\s*:\s*{([^}]*})/;

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        const text = document.getText();
        const matches = this.regex.exec(text);

        if (matches) {
            // Add install dependencies CodeLenses
            const position = document.positionAt(matches.index);
            const range = new vscode.Range(position, position);

            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(package) Install`,
                command: 'extension.npm.installDependencies',
                arguments: [document.uri]
            }));
            // Add run script CodeLenses
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
                        arguments: [script, document.uri]
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
        vscode.commands.registerCommand('extension.npm.runScript', (script: string, uri: vscode.Uri) => {
            const terminal = vscode.window.createTerminal({
                name: 'NPM Script',
                cwd: path.dirname(uri.fsPath)
            });
            terminal.sendText(`npm run ${script}`);
            terminal.show();
        }),
        vscode.commands.registerCommand('extension.npm.installDependencies', async (uri: vscode.Uri) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) return;

            const packageJsonDir = path.dirname(uri.fsPath);
            const hasNpmLock = fs.existsSync(path.join(packageJsonDir, 'package-lock.json'));
            const terminal = vscode.window.createTerminal({
                name: 'Package Install',
                cwd: packageJsonDir
            });

            if (hasNpmLock) {
                terminal.sendText('npm install --registry https://registry.npmmirror.com');
            } else {
                terminal.sendText('yarn --registry https://registry.npmmirror.com');
            }
            terminal.show();
        })
    );
}
