import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { selector } from '../npmCheckCommon';
import { getTerminalByCwd, getWorkingDirectory, ignoreWarnings } from '../../runner/runner';

export class NpmScriptCodeLensProvider implements vscode.CodeLensProvider {
    private regex: RegExp = /"scripts"\s*:\s*{([^}]*})/;

    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        const text = document.getText();
        const matches = this.regex.exec(text);

        if (matches) {
            const position = document.positionAt(matches.index);
            const range = new vscode.Range(position, position);

            codeLenses.push(new vscode.CodeLens(range, {
                title: `$(cloud-download) Install`,
                command: 'extension.npm.installDependencies',
                arguments: [document.uri]
            }));

            const startIdx = text.indexOf('{', matches.index);
            if (startIdx !== -1) {
                let braceCount = 0;
                let inString = false;
                let escape = false;
                let endIdx = startIdx;
                for (let i = startIdx; i < text.length; i++) {
                    const char = text[i];
                    if (escape) {
                        escape = false;
                        continue;
                    }
                    if (char === '\\') {
                        escape = true;
                        continue;
                    }
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    if (!inString) {
                        if (char === '{') braceCount++;
                        if (char === '}') braceCount--;
                        if (braceCount === 0) {
                            endIdx = i;
                            break;
                        }
                    }
                }
                const scriptsText = text.substring(startIdx, endIdx + 1);
                const scriptRegex = /"([^"]+)"\s*:/g;
                let match: RegExpExecArray | null;
                while ((match = scriptRegex.exec(scriptsText)) !== null) {
                    const script = match[1];
                    const scriptPos = document.positionAt(startIdx + match.index);
                    const scriptRange = new vscode.Range(scriptPos, scriptPos);
                    codeLenses.push(new vscode.CodeLens(scriptRange, {
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
        vscode.commands.registerCommand('extension.npm.runScript', async (script: string, uri: vscode.Uri) => {
            const cwd = await getWorkingDirectory(uri.fsPath)
            const terminal = getTerminalByCwd(cwd)
            terminal.sendText(`${ignoreWarnings} npm run ${script}`);
            terminal.show();
        }),
        vscode.commands.registerCommand('extension.npm.installDependencies', async (uri: vscode.Uri) => {
            const cwd = await getWorkingDirectory(uri.fsPath)
            const hasNpmLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
            const terminal = getTerminalByCwd(cwd);
            if (hasNpmLock) {
                terminal.sendText('npm install --registry https://registry.npmmirror.com');
            } else {
                terminal.sendText('yarn --registry https://registry.npmmirror.com');
            }
            terminal.show();
        })
    );
}
