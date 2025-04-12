import { commands, window, Uri, env } from 'vscode';

export function activateNpmGoto(context: any) {
    const disposable = commands.registerCommand('extension.gotoNpm', async () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line);

        // 检查当前行是否在 dependencies 块内
        let isInDependencies = false;
        for (let i = 0; i <= position.line; i++) {
            const currentLine = document.lineAt(i);
            if (/"(\w*?)dependencies"/i.test(currentLine.text)) {
                isInDependencies = true;
            } else if (currentLine.text.includes('}')) {
                isInDependencies = false;
            }
        }

        const matches = isInDependencies ? line.text.match(/"(.*?)"/) : null;
        const targetUri = Uri.parse(matches ? `https://www.npmjs.com/package/${matches[1]}` : 'https://www.npmjs.com');
        env.openExternal(targetUri);
    });

    context.subscriptions.push(disposable);
}