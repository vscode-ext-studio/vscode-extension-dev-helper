import { Position, Location, Uri, SymbolKind } from 'vscode';
import { TextDocument } from 'vscode';
import { WorkspaceManager } from '../../workspace/workspaceManager';
import { JavaFileInfo, JavaSymbol } from '../../parser/javaAstParser';
import { extractSimpleTypeName, isQualifiedTypeName } from './typeNameUtils';

export class MemberFinder {
    constructor(private workspaceManager: WorkspaceManager) { }

    public findMember(currentFileInfo: JavaFileInfo, memberName: string, className: string): Location | undefined {
        const memberSymbol = this.findMemberSymbol(currentFileInfo, memberName, className);
        if (memberSymbol) {
            const fileInfo = this.findClassFileInfo(currentFileInfo, className);
            if (fileInfo) {
                return new Location(Uri.parse(fileInfo.uri), memberSymbol.range);
            }
        }
        return undefined;
    }

    public findMemberSymbol(currentFileInfo: JavaFileInfo, memberName: string, className: string): JavaSymbol | undefined {
        const fileInfo = this.findClassFileInfo(currentFileInfo, className);
        if (!fileInfo) {
            return undefined;
        }

        let lombokFieldName = memberName.replace(/^(get|set)/, '');
        if (lombokFieldName.length > 0) {
            lombokFieldName = lombokFieldName.charAt(0).toLowerCase() + lombokFieldName.slice(1);
        }
        return this.findMemberInSymbols(fileInfo.symbols, memberName, lombokFieldName);
    }

    private findClassFileInfo(currentFileInfo: JavaFileInfo, className: string): JavaFileInfo | undefined {
        const trimmed = className.trim();
        if (isQualifiedTypeName(trimmed)) {
            const directMatch = this.workspaceManager.get(currentFileInfo.modulePath, trimmed);
            if (directMatch) {
                return directMatch;
            }
        }

        const simpleClassName = extractSimpleTypeName(trimmed);

        for (const importInfo of currentFileInfo.importInfos) {
            const isWildcardImport = importInfo.identifier === '*';
            if (importInfo.identifier === simpleClassName || isWildcardImport) {
                const qualifiedName = isWildcardImport ? importInfo.qualifiedName.replace(/\*/g, simpleClassName) : importInfo.qualifiedName;
                const fileInfo = this.workspaceManager.get(currentFileInfo.modulePath, qualifiedName);
                if (fileInfo) {
                    return fileInfo;
                }
            }
        }

        if (currentFileInfo.packageName) {
            const qualifiedName = `${currentFileInfo.packageName}.${simpleClassName}`;
            const fileInfo = this.workspaceManager.get(currentFileInfo.modulePath, qualifiedName);
            if (fileInfo) {
                return fileInfo;
            }
        }

        return undefined;
    }

    private findMemberInSymbols(symbols: JavaSymbol[], memberName: string, lombokFieldName: string): JavaSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.name === memberName &&
                [SymbolKind.Method, SymbolKind.Field, SymbolKind.Constant, SymbolKind.EnumMember].includes(symbol.kind)
            ) {
                return symbol;
            } else if (symbol.name === lombokFieldName && symbol.kind === SymbolKind.Field) {
                return symbol;
            }

            if (symbol.children) {
                const result = this.findMemberInSymbols(symbol.children, memberName, lombokFieldName);
                if (result) {
                    return result;
                }
            }
        }
        return undefined;
    }

    public getTypeNameAtPosition(document: TextDocument, position: Position): string | undefined {
        const line = document.lineAt(position.line);
        const text = line.text;

        let start = position.character - 1;
        while (start >= 0 && /[a-zA-Z0-9_.]/.test(text[start])) {
            start--;
        }
        start++;

        const typeName = text.substring(start, position.character);
        return typeName;
    }

} 