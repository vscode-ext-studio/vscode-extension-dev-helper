import { JavaFileInfo } from '../parser/javaAstParser';
import { SymbolKind } from 'vscode';

export interface WorkspaceTypeInfo {
    simpleName: string;
    qualifiedName: string;
    kind: SymbolKind;
}

export class JavaFileCache {
    private pathCache: { [key: string]: JavaFileInfo } = {};
    private cache: { [key: string]: { [key: string]: JavaFileInfo } } = {};


    public getByFilePath(filePath: string): JavaFileInfo | undefined {
        return this.pathCache[filePath];
    }

    public get(modulePath: string, qualifiedName: string): JavaFileInfo | undefined {
        if (this.cache[modulePath]?.[qualifiedName]) {
            return this.cache[modulePath][qualifiedName];
        }

        for (const module in this.cache) {
            if (module !== modulePath && this.cache[module][qualifiedName]) {
                return this.cache[module][qualifiedName];
            }
        }

        return undefined;
    }

    public set(filePath: string, modulePath: string, qualifiedName: string, info: JavaFileInfo): void {
        if (!this.cache[modulePath]) {
            this.cache[modulePath] = {};
        }
        this.pathCache[filePath] = info;
        this.cache[modulePath][qualifiedName] = info;
    }

    public delete(modulePath: string, qualifiedName: string): void {
        if (this.cache[modulePath]) {
            delete this.cache[modulePath][qualifiedName];
        }
    }

    public clear(): void {
        this.cache = {};
    }

    public findTypesBySimpleName(prefix: string): WorkspaceTypeInfo[] {
        const results: WorkspaceTypeInfo[] = [];
        const seen = new Set<string>();

        for (const module in this.cache) {
            for (const qualifiedName in this.cache[module]) {
                const info = this.cache[module][qualifiedName];
                const simpleName = info.typeSymbol?.name;
                if (!simpleName || !simpleName.startsWith(prefix)) {
                    continue;
                }
                if (seen.has(qualifiedName)) {
                    continue;
                }
                seen.add(qualifiedName);
                results.push({
                    simpleName,
                    qualifiedName,
                    kind: info.typeSymbol.kind,
                });
            }
        }

        return results;
    }

    public findTypesByQualifiedPrefix(prefix: string): WorkspaceTypeInfo[] {
        const results: WorkspaceTypeInfo[] = [];
        const seen = new Set<string>();

        for (const module in this.cache) {
            for (const qualifiedName in this.cache[module]) {
                if (!qualifiedName.startsWith(prefix)) {
                    continue;
                }
                const info = this.cache[module][qualifiedName];
                const simpleName = info.typeSymbol?.name;
                if (!simpleName) {
                    continue;
                }
                if (seen.has(qualifiedName)) {
                    continue;
                }
                seen.add(qualifiedName);
                results.push({
                    simpleName,
                    qualifiedName,
                    kind: info.typeSymbol.kind,
                });
            }
        }

        return results;
    }

} 