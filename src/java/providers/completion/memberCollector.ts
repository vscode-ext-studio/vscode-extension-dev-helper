import { TextDocument, Uri, workspace, SymbolKind, Position } from 'vscode';
import { JavaFileInfo, JavaSymbol } from '../../parser/javaAstParser';
import { MemberFinder } from '../definition/memberFinder';
import { SymbolFinder } from '../definition/symbolFinder';
import { CompletionMember, generateLombokMembers } from './lombokSupport';
import { isVisibleForMemberCompletion, parseMemberVisibility } from './visibilityUtils';
import {
    isBaseMapperEntityReturnMethod,
    isServiceEntityReturnMethod,
    resolveServiceImplTypes,
} from '../definition/mybatisPlusResolver';

export class MemberCollector {
    constructor(
        private memberFinder: MemberFinder,
        private symbolFinder: SymbolFinder,
    ) { }

    public async collectMembers(
        currentFileInfo: JavaFileInfo,
        receiverTypeName: string,
        currentDocument?: TextDocument,
    ): Promise<CompletionMember[]> {
        const classFileInfo = receiverTypeName === currentFileInfo.typeSymbol.name
            ? currentFileInfo
            : this.memberFinder.findClassFileInfo(currentFileInfo, receiverTypeName);

        if (!classFileInfo) {
            return [];
        }

        const members: CompletionMember[] = [];
        const added = new Set<string>();

        const addMember = (member: CompletionMember) => {
            if (added.has(member.name)) {
                return;
            }
            added.add(member.name);
            members.push(member);
        };

        const allowPrivateAccess = classFileInfo.qualifiedName === currentFileInfo.qualifiedName;

        const document = currentDocument && classFileInfo.filePath === currentDocument.uri.fsPath
            ? currentDocument
            : await workspace.openTextDocument(Uri.file(classFileInfo.filePath));

        this.collectSymbolMembers(classFileInfo.symbols, addMember, document, allowPrivateAccess);
        this.appendMybatisPlusMembers(classFileInfo, addMember, allowPrivateAccess);

        for (const lombokMember of generateLombokMembers(classFileInfo, document)) {
            addMember(lombokMember);
        }

        return members;
    }

    public resolveReceiverTypeName(
        fileInfo: JavaFileInfo,
        position: Position,
        receiver: string,
    ): string | undefined {
        if (receiver === 'this') {
            return fileInfo.typeSymbol.name;
        }

        const parts = receiver.split('.');
        let typeName = parts[0] === 'this' ? fileInfo.typeSymbol.name : parts[0];

        if (parts[0] !== 'this') {
            const rootSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, position, parts[0]);
            if (rootSymbol?.typeName) {
                typeName = rootSymbol.typeName;
            } else if (!this.memberFinder.findClassFileInfo(fileInfo, parts[0])) {
                const symbol = this.findSymbolByName(fileInfo, parts[0]);
                if (symbol?.typeName) {
                    typeName = symbol.typeName;
                }
            }
        }

        for (let i = 1; i < parts.length; i++) {
            const memberName = parts[i];
            const member = this.memberFinder.findMemberSymbol(fileInfo, memberName, typeName);
            if (member?.typeName) {
                typeName = member.typeName;
            } else {
                const lombokGetter = this.tryResolveLombokGetter(fileInfo, typeName, memberName);
                if (lombokGetter) {
                    typeName = lombokGetter;
                }
            }
        }

        return typeName;
    }

    private tryResolveLombokGetter(
        fileInfo: JavaFileInfo,
        className: string,
        methodName: string,
    ): string | undefined {
        const classFileInfo = this.memberFinder.findClassFileInfo(fileInfo, className);
        if (!classFileInfo) {
            return undefined;
        }

        const fields: JavaSymbol[] = [];
        this.collectFields(classFileInfo.symbols, fields);

        for (const field of fields) {
            const getterName = this.buildGetterName(field);
            if (getterName === methodName) {
                return field.typeName;
            }
        }
        return undefined;
    }

    private buildGetterName(field: JavaSymbol): string {
        const name = field.name;
        const type = field.typeName || '';
        const isBoolean = type === 'boolean' || type === 'Boolean';
        if (isBoolean) {
            if (name.startsWith('is') && name.length > 2) {
                return name;
            }
            return `is${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        }
        return `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }

    private collectFields(symbols: JavaSymbol[], fields: JavaSymbol[]): void {
        for (const symbol of symbols) {
            if (symbol.kind === SymbolKind.Field || symbol.kind === SymbolKind.Constant) {
                fields.push(symbol);
            }
            if (symbol.children) {
                this.collectFields(symbol.children, fields);
            }
        }
    }

    private findSymbolByName(fileInfo: JavaFileInfo, name: string): JavaSymbol | undefined {
        const search = (symbols: JavaSymbol[]): JavaSymbol | undefined => {
            for (const symbol of symbols) {
                if (symbol.name === name) {
                    return symbol;
                }
                if (symbol.children) {
                    const found = search(symbol.children);
                    if (found) {
                        return found;
                    }
                }
            }
            return undefined;
        };
        return search(fileInfo.symbols);
    }

    private collectSymbolMembers(
        symbols: JavaSymbol[],
        addMember: (member: CompletionMember) => void,
        document: TextDocument,
        allowPrivateAccess: boolean,
    ): void {
        for (const symbol of symbols) {
            if ([
                SymbolKind.Method,
                SymbolKind.Field,
                SymbolKind.Constant,
                SymbolKind.EnumMember,
                SymbolKind.Constructor,
            ].includes(symbol.kind)) {
                const visibility = parseMemberVisibility(document, symbol);
                if (!isVisibleForMemberCompletion(symbol, visibility, allowPrivateAccess)) {
                    continue;
                }
                addMember({
                    name: symbol.name,
                    kind: symbol.kind,
                    typeName: symbol.typeName,
                    detail: symbol.typeName,
                });
            }
            if (symbol.children) {
                this.collectSymbolMembers(symbol.children, addMember, document, allowPrivateAccess);
            }
        }
    }

    private appendMybatisPlusMembers(
        classFileInfo: JavaFileInfo,
        addMember: (member: CompletionMember) => void,
        allowPrivateAccess: boolean,
    ): void {
        const serviceImplTypes = resolveServiceImplTypes(classFileInfo);
        if (serviceImplTypes) {
            addMember({ name: 'getBaseMapper', kind: SymbolKind.Method, typeName: serviceImplTypes.mapperType, isSynthetic: true });
            if (allowPrivateAccess) {
                addMember({ name: 'baseMapper', kind: SymbolKind.Field, typeName: serviceImplTypes.mapperType, isSynthetic: true });
            }
            for (const methodName of ['getById', 'getOne', 'list', 'listByIds', 'page', 'save', 'updateById', 'removeById']) {
                if (isServiceEntityReturnMethod(methodName)) {
                    addMember({
                        name: methodName,
                        kind: SymbolKind.Method,
                        typeName: serviceImplTypes.entityType,
                        isSynthetic: true,
                    });
                }
            }
        }

        if (classFileInfo.typeSymbol.entityType) {
            for (const methodName of ['selectById', 'selectOne', 'selectList', 'selectBatchIds', 'selectPage']) {
                if (isBaseMapperEntityReturnMethod(methodName)) {
                    addMember({
                        name: methodName,
                        kind: SymbolKind.Method,
                        typeName: classFileInfo.typeSymbol.entityType,
                        isSynthetic: true,
                    });
                }
            }
        }
    }
}
