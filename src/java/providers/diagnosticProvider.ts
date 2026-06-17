import { Diagnostic, DiagnosticSeverity, DiagnosticCollection, languages, TextDocument, Range, Position } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';

export class JavaDiagnosticProvider {
    private diagnosticCollection: DiagnosticCollection;

    constructor(private workspaceManager: WorkspaceManager) {
        this.diagnosticCollection = languages.createDiagnosticCollection('java-simple-support');
    }

    public updateDiagnostics(document: TextDocument): void {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo || !fileInfo.errors) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        const diagnostics: Diagnostic[] = [];
        for (const error of fileInfo.errors) {
            const start = new Position(error.line - 1, error.char);
            const end = new Position(error.line - 1, error.char + 1);
            const diagnostic = new Diagnostic(
                new Range(start, end),
                error.message,
                DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
} 