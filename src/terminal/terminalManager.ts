import * as vscode from 'vscode';

export function activateTerminalManager(context: vscode.ExtensionContext): void {
    // 注册关闭其他终端的命令
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.closeOtherTerminals', () => {
            const terminals = vscode.window.terminals;
            const activeTerminal = vscode.window.activeTerminal;

            if (!activeTerminal) return;

            terminals.forEach(terminal => {
                if (terminal !== activeTerminal) {
                    terminal.dispose();
                }
            });
        })
    );

    // 注册关闭所有终端的命令
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.closeAllTerminals', () => {
            vscode.window.terminals.forEach(terminal => {
                terminal.dispose();
            });
        })
    );
}
