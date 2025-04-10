'use strict'
import * as vsc from 'vscode'
import { activatePostfix } from './postfix/postfix'
import { activateRunner } from './runner/runner'

export function activate(context: vsc.ExtensionContext): void {
  activatePostfix(context)
  activateRunner(context)
}

export function deactivate(): void {
}
