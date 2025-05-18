import { ExtensionContext, window, commands, workspace, Terminal, debug, TextEditor, TextDocument } from 'vscode'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'

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
    context.subscriptions.push(
        commands.registerCommand('extension.runFile', () => executeFile('run')),
        commands.registerCommand('extension.debugFile', () => executeFile('debug'))
    )
}

async function executeFile(mode: 'run' | 'debug') {
    const editor = getActiveEditor()
    if (!editor) return

    const document = editor.document
    if (!validateDocument(document)) return

    try {
        const runnerConfig = getRunnerConfig(document)
        const filePath = document.uri.fsPath

        if (mode === 'run') {
            await runFileInTerminal(filePath, runnerConfig)
        } else {
            await debugFile(filePath, runnerConfig)
        }
    } catch (error) {
        window.showErrorMessage(`Failed to ${mode}: ${error}`)
    }
}


function getActiveEditor(): TextEditor | undefined {
    const editor = window.activeTextEditor
    if (!editor) {
        window.showErrorMessage('No active editor')
        return undefined
    }
    return editor
}

function validateDocument(document: TextDocument): boolean {
    if (!['javascript', 'typescript'].includes(document.languageId)) {
        window.showErrorMessage('Only JavaScript and TypeScript files are supported')
        return false
    }
    return true
}

function getRunnerConfig(document: TextDocument): RunnerConfig {
    const config = workspace.getConfiguration('runner')
    return document.languageId === 'javascript'
        ? config.get('jsRunner') || defaultJsRunner
        : config.get('tsRunner') || defaultTsRunner
}

async function hasPackageJson(filePath: string): Promise<boolean> {
    const directory = path.dirname(filePath)
    const packageJsonPath = path.join(directory, 'package.json')
    return new Promise(resolve => {
        fs.access(packageJsonPath, fs.constants.F_OK, (err) => {
            resolve(!err)
        })
    })
}

async function runFileInTerminal(filePath: string, runnerConfig: RunnerConfig) {
    if (!terminal || terminal.exitStatus || terminal.state.shell == 'node') {
        terminal = window.createTerminal('Runner')
    }

    const directory = path.dirname(filePath)
    const hasPackageJsonFile = await hasPackageJson(filePath)

    if (hasPackageJsonFile) {
        terminal.sendText(`cd "${directory}"\n`)
    }

    const ignoreWarnings = process.platform === 'win32' ? 'set NODE_NO_WARNINGS=1' : 'NODE_NO_WARNINGS=1'
    const command = `${ignoreWarnings} ${runnerConfig.command} ${filePath}`
    terminal.show()
    terminal.sendText(command)
}

async function debugFile(filePath: string, runnerConfig: RunnerConfig) {
    const debugConfig = {
        type: 'node',
        request: 'launch',
        name: 'Debug Current File',
        program: filePath,
        skipFiles: ['<node_internals>/**'],
        runtimeExecutable: runnerConfig.command,
        runtimeArgs: runnerConfig.args || [],
        console: 'integratedTerminal'
    }

    await debug.startDebugging(undefined, debugConfig)
}
