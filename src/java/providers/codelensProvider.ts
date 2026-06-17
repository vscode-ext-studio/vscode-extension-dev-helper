import { CodeLens, CodeLensProvider, TextDocument, CancellationToken, Range, Command, SymbolKind } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { MapperInfo, MapperManager } from 'src/workspace/mapperManager';
import { JavaSymbol } from '../parser/javaAstParser';

export class JavaMyBatisCodeLensProvider implements CodeLensProvider {
    constructor(private workspaceManager: WorkspaceManager, private mapperManager: MapperManager) { }

    provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo) {
            return [];
        }

        const mapperInfo = this.mapperManager.getMapperInfo(fileInfo.qualifiedName);
        if (!mapperInfo) {
            return [];
        }

        const codeLenses: CodeLens[] = [];
        this.processSymbols(fileInfo.symbols, mapperInfo, codeLenses);
        return codeLenses;
    }

    private processSymbols(symbols: JavaSymbol[], mapperInfo: MapperInfo, codeLenses: CodeLens[]): void {
        for (const symbol of symbols) {
            if (symbol.kind === SymbolKind.Interface) {
                const range = new Range(
                    symbol.identifierLocation.line,
                    symbol.identifierLocation.character,
                    symbol.identifierLocation.line,
                    symbol.identifierLocation.character + symbol.name.length
                );
                const command: Command = {
                    title: 'Go to Mapper',
                    command: 'java-simple-support.gotoMapper',
                    arguments: [mapperInfo.uri, range]
                };
                codeLenses.push(new CodeLens(range, command));
            } else if (symbol.kind === SymbolKind.Method) {
                const matchingElement = mapperInfo.elements.find(element => element.id === symbol.name);
                if (matchingElement) {
                    const range = new Range(
                        symbol.identifierLocation.line,
                        symbol.identifierLocation.character,
                        symbol.identifierLocation.line,
                        symbol.identifierLocation.character + symbol.name.length
                    );

                    const command: Command = {
                        title: 'Go to Mapper',
                        command: 'java-simple-support.gotoMapper',
                        arguments: [mapperInfo.uri, range, new Range(matchingElement.line - 1, matchingElement.column - 1, matchingElement.line - 1, matchingElement.column - 1)]
                    };

                    codeLenses.push(new CodeLens(range, command));
                }
            }

            if (symbol.children) {
                this.processSymbols(symbol.children, mapperInfo, codeLenses);
            }
        }
    }
} 