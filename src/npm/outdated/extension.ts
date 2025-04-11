import { CodeActionKind, commands, ExtensionContext, languages, TextDocument, } from 'vscode'
import { PackageJsonCodeActionProvider } from './CodeAction'
import { COMMAND_INSTALL, COMMAND_INSTALL_REQUEST, packageInstall, packageInstallRequest, } from './Command'
import { diagnosticSubscribe, generatePackagesDiagnostics, } from './Diagnostic'
import { lazyCallback } from './Utils'
import { selector } from '../npmCheckCommon'

export function activateOutdated(context: ExtensionContext): void {
  const diagnostics = languages.createDiagnosticCollection()

  diagnosticSubscribe(
    context,
    diagnostics,
    lazyCallback(async (document: TextDocument) => {
      await generatePackagesDiagnostics(document, diagnostics)
    })
  )

  context.subscriptions.push(
    diagnostics,
    commands.registerCommand(COMMAND_INSTALL_REQUEST, (document: TextDocument) => {
      packageInstallRequest(document)
    }),
    commands.registerCommand(COMMAND_INSTALL, packageInstall),
    languages.registerCodeActionsProvider(
      selector,
      new PackageJsonCodeActionProvider(),
      { providedCodeActionKinds: [CodeActionKind.QuickFix] }
    )
  )
}
