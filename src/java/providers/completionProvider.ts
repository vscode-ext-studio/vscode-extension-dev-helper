import {
    CancellationToken,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    Position,
    SnippetString,
    SymbolKind,
    TextDocument,
} from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { JavaFileInfo, JavaSymbol } from '../parser/javaAstParser';
import { WorkspaceTypeInfo } from '../workspace/javaFileCache';
import { MemberFinder } from './definition/memberFinder';
import { SymbolFinder } from './definition/symbolFinder';
import { getCompletionContext } from './completion/completionContext';
import { MemberCollector } from './completion/memberCollector';
import { CompletionMember } from './completion/lombokSupport';
import { createImportEdit, isImportRequired } from './completion/importUtils';

const KEYWORDS = [
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
    'char', 'class', 'const', 'continue', 'default', 'do', 'double',
    'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
    'if', 'implements', 'import', 'instanceof', 'int', 'interface',
    'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while',
    'var', 'record', 'sealed', 'permits', 'yield',
];

export class JavaCompletionProvider implements CompletionItemProvider {
    private memberFinder: MemberFinder;
    private symbolFinder: SymbolFinder;
    private memberCollector: MemberCollector;

    constructor(private workspaceManager: WorkspaceManager) {
        this.memberFinder = new MemberFinder(workspaceManager);
        this.symbolFinder = new SymbolFinder();
        this.memberCollector = new MemberCollector(this.memberFinder, this.symbolFinder);
    }

    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken
    ): Promise<CompletionItem[]> {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo) {
            return this.getKeywordItems('');
        }

        const context = getCompletionContext(document, position);

        if (context.kind === 'member') {
            return this.provideMemberCompletions(fileInfo, document, position, context.receiver, context.prefix);
        }

        if (context.kind === 'import') {
            return this.provideImportCompletions(fileInfo, context.prefix);
        }

        return this.provideGeneralCompletions(fileInfo, document, context.prefix);
    }

    private async provideMemberCompletions(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        position: Position,
        receiver: string,
        prefix: string,
    ): Promise<CompletionItem[]> {
        const receiverTypeName = this.memberCollector.resolveReceiverTypeName(fileInfo, position, receiver);
        if (!receiverTypeName) {
            return [];
        }

        const members = await this.memberCollector.collectMembers(fileInfo, receiverTypeName, document);
        const items: CompletionItem[] = [];

        for (const member of members) {
            if (prefix && !member.name.startsWith(prefix)) {
                continue;
            }
            items.push(this.toCompletionItem(member));
        }

        return items;
    }

    private provideImportCompletions(fileInfo: JavaFileInfo, prefix: string): CompletionItem[] {
        const items: CompletionItem[] = [];
        if (!prefix) {
            return items;
        }

        const added = new Set<string>();
        const lastDot = prefix.lastIndexOf('.');

        let types: WorkspaceTypeInfo[];
        if (lastDot >= 0) {
            const packagePrefix = prefix.substring(0, lastDot + 1);
            const simplePrefix = prefix.substring(lastDot + 1);
            types = this.workspaceManager.findTypesByQualifiedPrefix(packagePrefix)
                .filter(type => type.simpleName.startsWith(simplePrefix));
        } else {
            types = this.workspaceManager.findTypesBySimpleName(prefix);
        }

        for (const type of types) {
            if (added.has(type.qualifiedName)) {
                continue;
            }
            added.add(type.qualifiedName);
            const item = new CompletionItem(type.qualifiedName, this.typeKindToCompletionKind(type.kind));
            item.detail = type.simpleName;
            item.sortText = `0_${type.qualifiedName}`;
            items.push(item);
        }

        return items;
    }

    private provideGeneralCompletions(fileInfo: JavaFileInfo, document: TextDocument, prefix: string): CompletionItem[] {
        const items: CompletionItem[] = [];
        const added = new Set<string>();

        for (const keyword of KEYWORDS) {
            if (!prefix || keyword.startsWith(prefix)) {
                if (!added.has(keyword)) {
                    added.add(keyword);
                    items.push(new CompletionItem(keyword, CompletionItemKind.Keyword));
                }
            }
        }

        for (const importInfo of fileInfo.importInfos) {
            if (importInfo.identifier === '*') {
                continue;
            }
            if (!prefix || importInfo.identifier.startsWith(prefix)) {
                if (!added.has(importInfo.qualifiedName)) {
                    added.add(importInfo.qualifiedName);
                    const item = new CompletionItem(importInfo.identifier, CompletionItemKind.Class);
                    item.detail = importInfo.qualifiedName;
                    item.sortText = `0_${importInfo.identifier}`;
                    items.push(item);
                }
            }
        }

        this.collectSymbolCompletions(fileInfo.symbols, items, added, prefix);

        if (prefix) {
            for (const type of this.workspaceManager.findTypesBySimpleName(prefix)) {
                const item = this.createTypeCompletionItem(fileInfo, document, type, added);
                if (item) {
                    items.push(item);
                }
            }
        }

        return items;
    }

    private createTypeCompletionItem(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        type: WorkspaceTypeInfo,
        added: Set<string>,
    ): CompletionItem | undefined {
        if (added.has(type.qualifiedName)) {
            return undefined;
        }
        added.add(type.qualifiedName);

        const item = new CompletionItem(type.simpleName, this.typeKindToCompletionKind(type.kind));
        item.detail = type.qualifiedName;

        if (isImportRequired(fileInfo, type.qualifiedName)) {
            item.sortText = `2_${type.simpleName}`;
            item.additionalTextEdits = [createImportEdit(document, type.qualifiedName)];
        } else {
            item.sortText = `1_${type.simpleName}`;
        }

        return item;
    }

    private collectSymbolCompletions(
        symbols: JavaSymbol[],
        items: CompletionItem[],
        added: Set<string>,
        prefix: string,
    ): void {
        for (const symbol of symbols) {
            if (!prefix || symbol.name.startsWith(prefix)) {
                const key = symbol.name;
                if (!added.has(key)) {
                    added.add(key);
                    const item = new CompletionItem(symbol.name, this.toCompletionItemKind(symbol.kind));
                    if (symbol.typeName) {
                        item.detail = symbol.typeName;
                    }
                    item.sortText = `1_${symbol.name}`;
                    items.push(item);
                }
            }
            if (symbol.children) {
                this.collectSymbolCompletions(symbol.children, items, added, prefix);
            }
        }
    }

    private typeKindToCompletionKind(kind: SymbolKind): CompletionItemKind {
        switch (kind) {
            case SymbolKind.Interface:
                return CompletionItemKind.Interface;
            case SymbolKind.Enum:
                return CompletionItemKind.Enum;
            case SymbolKind.Class:
            default:
                return CompletionItemKind.Class;
        }
    }

    private toCompletionItem(member: CompletionMember): CompletionItem {
        const item = new CompletionItem(member.name, this.toCompletionItemKind(member.kind));
        if (member.detail) {
            item.detail = member.detail;
        } else if (member.typeName) {
            item.detail = member.typeName;
        }
        if (member.isSynthetic) {
            item.documentation = 'Lombok / MyBatis-Plus 生成成员';
        }
        if (member.kind === SymbolKind.Method) {
            item.insertText = new SnippetString(`${member.name}($0)`);
        }
        return item;
    }

    private toCompletionItemKind(kind: SymbolKind): CompletionItemKind {
        switch (kind) {
            case SymbolKind.Class:
                return CompletionItemKind.Class;
            case SymbolKind.Interface:
                return CompletionItemKind.Interface;
            case SymbolKind.Enum:
                return CompletionItemKind.Enum;
            case SymbolKind.Method:
            case SymbolKind.Constructor:
                return CompletionItemKind.Method;
            case SymbolKind.Field:
                return CompletionItemKind.Field;
            case SymbolKind.Constant:
                return CompletionItemKind.Constant;
            default:
                return CompletionItemKind.Variable;
        }
    }

    private getKeywordItems(prefix: string): CompletionItem[] {
        const items: CompletionItem[] = [];
        for (const keyword of KEYWORDS) {
            if (!prefix || keyword.startsWith(prefix)) {
                items.push(new CompletionItem(keyword, CompletionItemKind.Keyword));
            }
        }
        return items;
    }
}
