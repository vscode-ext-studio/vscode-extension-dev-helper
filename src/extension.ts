'use strict'
import * as vsc from 'vscode'
import { activatePostfix } from './postfix/postfix'
import { activateRunner } from './runner/runner'
import { activateNpmDependencyCheck } from './npm/npmDependencyChecker'
import { activateNpmGoto } from './npm/npmGotoCommand'

export function activate(context: vsc.ExtensionContext): void {
  activatePostfix(context)
  activateRunner(context)
  activateNpmGoto(context)
  activateNpmDependencyCheck(context)
}

export function deactivate(): void {
}
