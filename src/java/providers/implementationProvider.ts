import { ImplementationProvider, TextDocument, Position, Location, CancellationToken, Range, SymbolKind } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { SymbolFinder } from './definition/symbolFinder';
import { ImportClassFinder } from './definition/importClassFinder';
import { MemberFinder } from './definition/memberFinder';
import { MapperManager } from '../workspace/mapperManager';

export class JavaImplementationProvider implements ImplementationProvider {
    private symbolFinder: SymbolFinder;
    private importClassFinder: ImportClassFinder;
    private memberFinder: MemberFinder;

    constructor(
        private workspaceManager: WorkspaceManager,
        private mapperManager: MapperManager
    ) {
        this.symbolFinder = new SymbolFinder();
        this.importClassFinder = new ImportClassFinder(workspaceManager);
        this.memberFinder = new MemberFinder(workspaceManager);
    }

    public async provideImplementation(document: TextDocument, position: Position, token: CancellationToken): Promise<Location[] | undefined> {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo) {
            return undefined;
        }

        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        if (['String', 'Integer', 'Boolean', 'Double', 'Float', 'Long', 'Short', 'Byte', 'Character', 'Void', 'Null'].includes(word)) {
            return undefined;
        }

        // Check if the previous character is a dot
        if (wordRange.start.character > 1) {
            const prevCharPosition = new Position(position.line, wordRange.start.character - 1);
            const prevCharRange = new Range(prevCharPosition, prevCharPosition.translate(0, 1));
            const prevChar = document.getText(prevCharRange);

            if (prevChar === '.') {
                const typeNameRange = document.getWordRangeAtPosition(new Position(position.line, wordRange.start.character - 2));
                if (typeNameRange) {
                    const typeName = document.getText(typeNameRange);
                    if (typeName == 'this') {
                        const symbol = this.symbolFinder.findSymbolAtPosition(fileInfo, typeNameRange.start, word, { breadthFirst: true });
                        if (symbol) {
                            return [new Location(document.uri, symbol.range)];
                        }
                        return undefined;
                    }
                    const typeSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, typeNameRange.start, typeName);
                    const target = typeSymbol?.typeName || typeName;
                    const memberLocation = await this.memberFinder.findMember(fileInfo, word, target);
                    return memberLocation ? [memberLocation] : undefined;
                }
                return undefined;
            }
        }

        const localSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, position, word);
        if (localSymbol) {
            if (position.isAfterOrEqual(localSymbol.identifierLocation) &&
                position.isBeforeOrEqual(new Position(
                    localSymbol.identifierLocation.line,
                    localSymbol.identifierLocation.character + localSymbol.name.length
                ))) {
                if (localSymbol.kind === SymbolKind.Method) {
                    const mapperInfo = this.mapperManager.getMapperInfo(fileInfo.qualifiedName);
                    if (mapperInfo) {
                        const matchingElement = mapperInfo.elements.find(element => element.id === localSymbol.name);
                        if (matchingElement) {
                            return [new Location(
                                mapperInfo.uri,
                                new Range(matchingElement.line - 1, matchingElement.column - 1, matchingElement.line - 1, matchingElement.column - 1)
                            )];
                        }
                    }
                }
                return null;
            }

            return [new Location(
                document.uri,
                localSymbol.identifierLocation || localSymbol.range.start
            )];
        }

        const importedClassLocation = await this.importClassFinder.findImportedClass(fileInfo, word);
        return importedClassLocation ? [importedClassLocation] : undefined;
    }
} 