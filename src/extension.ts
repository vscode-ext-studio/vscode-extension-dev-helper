'use strict'
import * as vsc from 'vscode'
import { activatePostfix } from './postfix/postfix'
import { activateRunner } from './runner/runner'
import { activateNpmDependencyCheck } from './npm/npmDependencyChecker'
import { activateNpmGoto } from './npm/npmGotoCommand'
import { activateNpmScriptCodeLens } from './npm/provider/npmScriptCodeLens'
import { activateTerminalManager } from './terminal/terminalManager'

const jumpToScripts = async (uri: vsc.Uri) => {
  const document = await vsc.workspace.openTextDocument(uri)
  await vsc.window.showTextDocument(document)
  const text = document.getText()
  const scriptsMatch = /"scripts"\s*:\s*{/.exec(text)
  if (scriptsMatch) {
    const position = document.positionAt(scriptsMatch.index)
    const editor = vsc.window.activeTextEditor
    if (editor) {
      editor.selection = new vsc.Selection(position, position)
      editor.revealRange(new vsc.Range(position, position), vsc.TextEditorRevealType.InCenter)
    }
  }
}

export function activate(context: vsc.ExtensionContext): void {
  activatePostfix(context)
  activateRunner(context)
  activateNpmGoto(context)
  activateNpmScriptCodeLens(context)
  activateNpmDependencyCheck(context)
  activateTerminalManager(context)
  context.subscriptions.push(
    vsc.commands.registerCommand('extension.npm.jumpToScripts', jumpToScripts)
  )
}

export function deactivate(): void {
}
