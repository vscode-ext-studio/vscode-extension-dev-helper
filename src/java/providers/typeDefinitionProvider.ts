import { TypeDefinitionProvider, TextDocument, Position, Definition, CancellationToken, Range, SymbolKind } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { SymbolFinder } from './definition/symbolFinder';
import { ImportClassFinder } from './definition/importClassFinder';
import { MemberFinder } from './definition/memberFinder';
import { JavaFileInfo } from '../parser/javaAstParser';

export class JavaTypeDefinitionProvider implements TypeDefinitionProvider {
    private symbolFinder: SymbolFinder;
    private importClassFinder: ImportClassFinder;
    private memberFinder: MemberFinder;

    constructor(private workspaceManager: WorkspaceManager) {
        this.symbolFinder = new SymbolFinder();
        this.importClassFinder = new ImportClassFinder(workspaceManager);
        this.memberFinder = new MemberFinder(workspaceManager);
    }

    public async provideTypeDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Definition | undefined> {
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

        if (wordRange.start.character > 0) {
            const prevCharPosition = new Position(position.line, wordRange.start.character - 1);
            const prevCharRange = new Range(prevCharPosition, prevCharPosition.translate(0, 1));
            const prevChar = document.getText(prevCharRange);

            if (prevChar === '.') {
                return this.provideMemberTypeDefinition(fileInfo, document, position, wordRange, word);
            }
        }

        const localSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, position, word);
        if (localSymbol) {
            if (localSymbol.typeName) {
                return this.importClassFinder.findImportedClass(fileInfo, localSymbol.typeName);
            }
            if (localSymbol.kind === SymbolKind.EnumMember) {
                const enumType = this.findParentEnumType(fileInfo, localSymbol.name);
                if (enumType) {
                    return this.importClassFinder.findImportedClass(fileInfo, enumType);
                }
            }
        }

        return this.importClassFinder.findImportedClass(fileInfo, word);
    }

    private async provideMemberTypeDefinition(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        position: Position,
        wordRange: Range,
        word: string
    ): Promise<Definition | undefined> {
        const objectNameRange = document.getWordRangeAtPosition(
            new Position(position.line, wordRange.start.character - 2)
        );
        if (!objectNameRange) {
            return undefined;
        }

        const objectName = document.getText(objectNameRange);
        if (objectName === 'this') {
            const member = this.symbolFinder.findSymbolAtPosition(fileInfo, objectNameRange.start, word, { breadthFirst: true });
            if (member?.typeName) {
                return this.importClassFinder.findImportedClass(fileInfo, member.typeName);
            }
            return undefined;
        }

        const objectSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, objectNameRange.start, objectName);
        const targetClassName = objectSymbol?.typeName || objectName;
        const memberSymbol = this.memberFinder.findMemberSymbol(fileInfo, word, targetClassName);
        if (memberSymbol?.typeName) {
            return this.importClassFinder.findImportedClass(fileInfo, memberSymbol.typeName);
        }

        return undefined;
    }

    private findParentEnumType(fileInfo: JavaFileInfo, enumMemberName: string): string | undefined {
        for (const symbol of fileInfo.symbols) {
            if (symbol.kind === SymbolKind.Enum && symbol.children?.some(child => child.name === enumMemberName)) {
                return symbol.name;
            }
        }
        return undefined;
    }
}
