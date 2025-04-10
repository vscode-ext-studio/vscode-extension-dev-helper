'use strict'
import * as vsc from 'vscode'
import { activatePostfix } from './postfix/postfix'

export function activate(context: vsc.ExtensionContext): void {
  activatePostfix(context)
}


export function deactivate(): void {
}
