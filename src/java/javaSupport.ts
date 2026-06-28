import {
  commands,
  ExtensionContext,
  languages,
  Range,
  Selection,
  SemanticTokensLegend,
  window,
  workspace,
} from 'vscode'
import { JavaDefinitionProvider } from './providers/definitionProvider'
import { JavaOutlineProvider } from './providers/outlineProvider'
import { JavaFoldingProvider } from './providers/foldingProvider'
import { JavaTypeDefinitionProvider } from './providers/typeDefinitionProvider'
import { JavaImplementationProvider } from './providers/implementationProvider'
import { WorkspaceManager } from './workspace/workspaceManager'
import { MapperManager } from './workspace/mapperManager'
import { JavaMyBatisCodeLensProvider } from './providers/codelensProvider'
import { JavaDiagnosticProvider } from './providers/diagnosticProvider'
import { JavaTokenProvider } from './providers/tokenProvider'
import { JavaCompletionProvider } from './providers/completionProvider'

export function activateJavaSupport(context: ExtensionContext): void {
  const mapperManager = new MapperManager()
  const workspaceManager = new WorkspaceManager()
  const diagnosticProvider = new JavaDiagnosticProvider(workspaceManager)

  mapperManager.initialize()
  workspaceManager.initializeWorkspace()

  registerGotoMapperCommand(context)

  const documentChange = workspace.onDidChangeTextDocument((event) => {
    workspaceManager.onDocumentChange(event)
    mapperManager.onDocumentChange(event.document)
    diagnosticProvider.updateDiagnostics(event.document)
  })

  const selector = { language: 'java' }
  const tokenTypes = ['class', 'interface', 'enum', 'function', 'variable']
  const tokenModifiers = ['declaration', 'documentation']
  const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers)
  context.subscriptions.push(
    languages.registerDocumentSymbolProvider(selector, new JavaOutlineProvider(workspaceManager)),
    languages.registerFoldingRangeProvider(selector, new JavaFoldingProvider(workspaceManager)),
    languages.registerTypeDefinitionProvider(selector, new JavaTypeDefinitionProvider(workspaceManager)),
    languages.registerDefinitionProvider(selector, new JavaDefinitionProvider(workspaceManager, mapperManager)),
    languages.registerImplementationProvider(selector, new JavaImplementationProvider(workspaceManager, mapperManager)),
    languages.registerCodeLensProvider(selector, new JavaMyBatisCodeLensProvider(workspaceManager, mapperManager)),
    languages.registerDocumentSemanticTokensProvider(selector, new JavaTokenProvider(workspaceManager), legend),
    languages.registerCompletionItemProvider(selector, new JavaCompletionProvider(workspaceManager), '.'),
    documentChange,
    diagnosticProvider,
  )
}

function registerGotoMapperCommand(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand('java-simple-support.gotoMapper', async (uri: string, range: Range, selection?: Range) => {
      const editor = window.activeTextEditor
      if (editor) {
        editor.selection = new Selection(range.start, range.start)
        editor.revealRange(range)
      }
      await commands.executeCommand('vscode.open', uri, { selection })
    }),
  )
}
