import { TypeDefinitionProvider, TextDocument, Position, Definition, CancellationToken } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { SymbolFinder } from './definition/symbolFinder';
import { ImportClassFinder } from './definition/importClassFinder';

export class JavaTypeDefinitionProvider implements TypeDefinitionProvider {
    private symbolFinder: SymbolFinder;
    private importClassFinder: ImportClassFinder;

    constructor(private workspaceManager: WorkspaceManager) {
        this.symbolFinder = new SymbolFinder();
        this.importClassFinder = new ImportClassFinder(workspaceManager);
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

        const localSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, position, word);
        if (localSymbol && localSymbol.typeName) {
            return this.importClassFinder.findImportedClass(fileInfo, localSymbol.typeName);
        }

        // 查找导入的类
        return this.importClassFinder.findImportedClass(fileInfo, word);
    }
} 