import { sep } from 'path'
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, ExtensionContext, l10n, Range, TextDocument, TextDocumentChangeEvent, TextEditor, window, workspace, } from 'vscode'
import { DIAGNOSTIC_ACTION } from './CodeAction'
import { getDocumentPackages } from './Document'
import {
  DocumentDecoration,
  DocumentDecorationManager,
} from './DocumentDecoration'
import { DocumentDiagnostics } from './DocumentDiagnostics'
import {
  packagesInstalledCache,
} from './NPM'
import { PackageInfo } from './PackageInfo'
import {
  getDecorationsMode,
  getParallelProcessesLimit,
  getIgnorePackages,
} from './Settings'
import { promiseLimit } from './Utils'

const PACKAGE_JSON_PATH = `${sep}package.json`

const isPackageJsonDocument = (document: TextDocument): boolean =>
  document.fileName.endsWith(PACKAGE_JSON_PATH) || document.fileName.endsWith('dependencies.jsonc')

export const diagnosticSubscribe = (
  context: ExtensionContext,
  diagnostics: DiagnosticCollection,
  onChange: (document: TextDocument) => void
): void => {
  // Handles the active editor change, but only continues with package.json files.
  const handleChange = (document: TextDocument): void => {
    if (isPackageJsonDocument(document)) {
      onChange(document)
    }
  }

  // Trigger on the currently active editor, if any..
  if (window.activeTextEditor) {
    handleChange(window.activeTextEditor.document)
  }

  // Trigger when the active editor changes.
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor) {
        handleChange(editor.document)
      }
    })
  )

  // Trigger when the active document text is modified.
  context.subscriptions.push(
    workspace.onDidChangeTextDocument((editor: TextDocumentChangeEvent) =>
      handleChange(editor.document)
    )
  )

  // Trigger when any file in the workspace is modified.
  // Our interest here is to know about package-lock.json.
  context.subscriptions.push(
    workspace
      .createFileSystemWatcher('**/package-lock.json')
      .onDidChange(() => {
        packagesInstalledCache?.invalidate()

        window.visibleTextEditors.forEach((editor) =>
          handleChange(editor.document)
        )
      })
  )

  // Trigger when the active document is closed, removing the current document from the diagnostic collection.
  context.subscriptions.push(
    workspace.onDidCloseTextDocument((document: TextDocument) => {
      if (isPackageJsonDocument(document)) {
        diagnostics.delete(document.uri)

        DocumentDecorationManager.flushDocument(document)
      }
    })
  )
}

export enum DiagnosticType {
  GENERAL,
  READY_TO_INSTALL,
}

export class PackageRelatedDiagnostic extends Diagnostic {
  constructor(
    range: Range,
    message: string,
    severity: DiagnosticSeverity,
    document: TextDocument,
    public packageRelated: PackageInfo,
    public type = DiagnosticType.GENERAL
  ) {
    super(range, message, severity)

    this.code = { target: document.uri, value: DIAGNOSTIC_ACTION }
  }

  public static is(
    diagnostic: PackageRelatedDiagnostic | Diagnostic
  ): diagnostic is PackageRelatedDiagnostic {
    return 'packageRelated' in diagnostic
  }
}

export const getPackageDiagnostic = async (
  document: TextDocument,
  packageInfo: PackageInfo
): Promise<PackageRelatedDiagnostic | Diagnostic | undefined> => {
  if (!packageInfo.isVersionValidRange()) {
    return new Diagnostic(
      packageInfo.versionRange,
      l10n.t('Invalid package version.'),
      DiagnosticSeverity.Error
    )
  }

  const versionLatest = await packageInfo.getVersionLatest()

  // When no latest version is found, we just ignore it.
  // In practice, this is an exception-of-the-exception, and is expected to never happen.
  if (!versionLatest) {
    return
  }

  if (!(await packageInfo.isVersionReleased())) {
    return new PackageRelatedDiagnostic(
      packageInfo.versionRange,
      l10n.t('Package version not available.'),
      DiagnosticSeverity.Information,
      document,
      packageInfo
    )
  }

  if (!(await packageInfo.isVersionUpdatable())) {
    return
  }

  if (!(await packageInfo.isVersionMaxed())) {
    return new PackageRelatedDiagnostic(
      packageInfo.versionRange,
      l10n.t(
        'Newer version of "{0}" is available: {1}.',
        packageInfo.name,
        versionLatest
      ),
      DiagnosticSeverity.Warning,
      document,
      packageInfo
    )
  }

  // If the user-defined version is higher than the last available version, then the user is probably using a pre-release version.
  // In this case, we will only generate a informational diagnostic.
  if (packageInfo.isVersionPrerelease()) {
    return new Diagnostic(
      packageInfo.versionRange,
      l10n.t('Pre-release version of "{0}".', packageInfo.name),
      DiagnosticSeverity.Information
    )
  }

  // istanbul ignore next
  return
}

// Analyzes the document dependencies and returns the diagnostics.
export const generatePackagesDiagnostics = async (
  document: TextDocument,
  diagnosticsCollection: DiagnosticCollection
): Promise<void> => {
  // Read dependencies from package.json to get the name of packages used.
  const packagesInfos = Object.values(await getDocumentPackages(document))
  const ignorePackages = getIgnorePackages()

  const documentDecorations =
    getDecorationsMode() !== 'disabled'
      ? new DocumentDecoration(document)
      : undefined

  const documentDiagnostics = new DocumentDiagnostics(
    document,
    diagnosticsCollection
  )

  if (!documentDecorations) {
    DocumentDecorationManager.flushDocument(document)
  }

  const parallelProcessing = promiseLimit(getParallelProcessesLimit())

  // Obtains, through NPM, the latest available version of each installed package.
  // As a result of each promise, we will have the package name and its latest version.
  await Promise.all(
    packagesInfos.map((packageInfo) => {
      if (!packageInfo.isNameValid()) {
        return
      }

      if (packageInfo.isVersionComplex() || packageInfo.isVersionIgnorable()) {
        return
      }

      // Skip packages that are in the ignore list
      if (ignorePackages.includes(packageInfo.name)) {
        return
      }

      return parallelProcessing(async () => {
        documentDecorations?.setCheckingMessage(packageInfo.getLine())

        const packageDiagnostic = await getPackageDiagnostic(
          document,
          packageInfo
        )

        if (packageDiagnostic !== undefined) {
          documentDiagnostics.push(packageDiagnostic)

          if (PackageRelatedDiagnostic.is(packageDiagnostic)) {
            return documentDecorations?.setUpdateMessage(
              packageInfo.getLine(),
              packageDiagnostic
            )
          }

          if (packageDiagnostic.severity === DiagnosticSeverity.Error) {
            return documentDecorations?.clearLine(packageInfo.getLine())
          }
        }

        documentDecorations?.setCheckedMessage(packageInfo.getLine())
      })
    })
  )

  documentDiagnostics.render()
}
