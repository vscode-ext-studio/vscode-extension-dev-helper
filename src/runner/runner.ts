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

interface TerminalStore {
    [cwd: string]: Terminal;
}

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

export const ignoreWarnings = process.platform === 'win32' ? 'set NODE_NO_WARNINGS=1' : 'NODE_NO_WARNINGS=1'

async function runFileInTerminal(filePath: string, runnerConfig: RunnerConfig) {
    const cwd = await getWorkingDirectory(filePath)
    const terminal = getTerminalByCwd(cwd)
    const relativePath = path.relative(cwd, filePath)
    const command = `${ignoreWarnings} ${runnerConfig.command} ${relativePath}`
    terminal.show()
    terminal.sendText(command)
}

export function getTerminalByCwd(cwd: string): Terminal {
    let terminal = window.terminals.find(t => (t.creationOptions as any).cwd === cwd);
    if (!terminal || terminal.exitStatus || terminal.state.shell == 'node') {
        terminal = window.createTerminal({ cwd, name: path.basename(cwd) });
    }
    return terminal;
}

export async function getWorkingDirectory(filePath: string): Promise<string | undefined> {
    const rootPath = workspace.rootPath
    const isNotInWorkspace = !filePath.startsWith(rootPath);

    const hasPackageJsonFile = await hasPackageJson(filePath)
    if (hasPackageJsonFile || isNotInWorkspace) {
        return path.dirname(filePath)
    }

    return rootPath
}

async function debugFile(filePath: string, runnerConfig: RunnerConfig) {
    const cwd = await getWorkingDirectory(filePath)
    const debugConfig = {
        type: 'node',
        request: 'launch',
        name: 'Debug Current File',
        program: filePath,
        cwd,
        skipFiles: ['<node_internals>/**'],
        runtimeExecutable: runnerConfig.command,
        runtimeArgs: runnerConfig.args || [],
        console: 'integratedTerminal'
    }

    await debug.startDebugging(undefined, debugConfig)
}
