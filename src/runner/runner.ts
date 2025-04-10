import { ExtensionContext, window, commands, workspace, Terminal } from 'vscode'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface RunnerConfig {
    command: string
    args?: string[]
}

const defaultJsRunner: RunnerConfig = {
    command: 'node'
}

const defaultTsRunner: RunnerConfig = {
    command: 'tsx'
}

let terminal: Terminal | undefined

export function activateRunner(context: ExtensionContext) {
    // Register command
    const disposable = commands.registerCommand('extension.runFile', async () => {
        const editor = window.activeTextEditor
        if (!editor) {
            window.showErrorMessage('No active editor')
            return
        }

        const document = editor.document
        if (!['javascript', 'typescript'].includes(document.languageId)) {
            window.showErrorMessage('Only JavaScript and TypeScript files are supported')
            return
        }

        try {
            const config = workspace.getConfiguration('runner')
            const runnerConfig: RunnerConfig = document.languageId === 'javascript'
                ? config.get('jsRunner') || defaultJsRunner
                : config.get('tsRunner') || defaultTsRunner

            const filePath = document.uri.fsPath
            const command = `${runnerConfig.command} ${filePath}`

            // 检查终端是否存在且是否正在运行
            if (!terminal || terminal.exitStatus) {
                terminal = window.createTerminal('Runner')
            }

            terminal.show()
            terminal.sendText(command)
        } catch (error) {
            window.showErrorMessage(`Failed to run: ${error}`)
        }
    })

    context.subscriptions.push(disposable)
} 