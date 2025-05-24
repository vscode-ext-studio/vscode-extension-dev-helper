'use strict'
import * as vsc from 'vscode'
import { activatePostfix } from './postfix/postfix'
import { activateRunner } from './runner/runner'
import { activateNpmDependencyCheck } from './npm/npmDependencyChecker'
import { activateNpmGoto } from './npm/npmGotoCommand'
import { activateNpmScriptCodeLens } from './npm/provider/npmScriptCodeLens'
import { activateTerminalManager } from './terminal/terminalManager'

const jumpToSection = async (uri: vsc.Uri, section: string) => {
  const document = await vsc.workspace.openTextDocument(uri)
  await vsc.window.showTextDocument(document)
  const text = document.getText()
  const sectionMatch = new RegExp(`"${section}"\\s*:\\s*{`).exec(text)
  if (sectionMatch) {
    const position = document.positionAt(sectionMatch.index)
    const editor = vsc.window.activeTextEditor
    if (editor) {
      editor.selection = new vsc.Selection(position, position)
      editor.revealRange(new vsc.Range(position, position), vsc.TextEditorRevealType.InCenter)
    }
  }
}

const jumpToScripts = (uri: vsc.Uri) => jumpToSection(uri, 'scripts')
const jumpToDependencies = (uri: vsc.Uri) => jumpToSection(uri, 'dependencies')
const jumpToDevDependencies = (uri: vsc.Uri) => jumpToSection(uri, 'devDependencies')

export function activate(context: vsc.ExtensionContext): void {
  activatePostfix(context)
  activateRunner(context)
  activateNpmGoto(context)
  activateNpmScriptCodeLens(context)
  activateNpmDependencyCheck(context)
  activateTerminalManager(context)
  context.subscriptions.push(
    vsc.commands.registerCommand('extension.npm.jumpToScripts', jumpToScripts),
    vsc.commands.registerCommand('extension.npm.jumpToDependencies', jumpToDependencies),
    vsc.commands.registerCommand('extension.npm.jumpToDevDependencies', jumpToDevDependencies)
  )
}

export function deactivate(): void {
}
