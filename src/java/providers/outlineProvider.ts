import { DocumentSymbolProvider, TextDocument, SymbolInformation, CancellationToken, Location } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { JavaSymbol } from '../parser/javaAstParser';

export class JavaOutlineProvider implements DocumentSymbolProvider {
    constructor(private workspaceManager: WorkspaceManager) { }

    public async provideDocumentSymbols(
        document: TextDocument,
        token: CancellationToken
    ): Promise<SymbolInformation[]> {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo) {
            return [];
        }

        const result: SymbolInformation[] = [];

        const processSymbol = (symbol: JavaSymbol, containerName?: string) => {
            const kind = symbol.kind;
            const symbolInfo = new SymbolInformation(
                symbol.name,
                kind,
                containerName || null,
                new Location(document.uri, symbol.range)
            );
            result.push(symbolInfo);

            if (symbol.children) {
                for (const child of symbol.children) {
                    processSymbol(child, symbol.name);
                }
            }
        };

        for (const symbol of fileInfo.symbols) {
            processSymbol(symbol);
        }

        return result;
    }

} 