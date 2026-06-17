import { JavaFileInfo, JavaSymbol } from '../../parser/javaAstParser';
import { Position } from 'vscode';

export interface SymbolSearchOptions {
    breadthFirst?: boolean;
}

export class SymbolFinder {
    public findSymbolAtPosition(fileInfo: JavaFileInfo, position: Position, word: string, options: SymbolSearchOptions = {}): JavaSymbol | undefined {
        const { symbols } = fileInfo;
        const { breadthFirst = false } = options;
        if (breadthFirst) {
            return this.findSymbolBreadthFirst(symbols, position, word);
        }
        return this.findSymbolDepthFirst(symbols, position, word);
    }

    /**
     * 深度优先搜索
     */
    private findSymbolDepthFirst(symbols: JavaSymbol[], position: Position, word: string): JavaSymbol | undefined {
        // 深度遍历
        for (const symbol of symbols) {
            if (position.isAfterOrEqual(symbol.range.start) && position.isBeforeOrEqual(symbol.range.end)) {
                if (symbol.children) {
                    const child = this.findSymbolDepthFirst(symbol.children, position, word);
                    if (child) { return child; }
                }
                if (symbol.name === word) {
                    return symbol;
                }
            } else if (symbol.name === word) {
                return symbol;
            }
        }
        // 广度遍历
        for (const symbol of symbols) {
            if (symbol.name === word) {
                return symbol;
            }
        }
        return undefined;
    }


    /**
     * 广度优先搜索
     */
    private findSymbolBreadthFirst(symbols: JavaSymbol[], position: Position, word: string): JavaSymbol | undefined {
        // 广度遍历
        for (const symbol of symbols) {
            if (symbol.name === word) {
                return symbol;
            }
        }
        // 深度遍历
        for (const symbol of symbols) {
            if (position.isAfterOrEqual(symbol.range.start) && position.isBeforeOrEqual(symbol.range.end)) {
                if (symbol.children) {
                    const child = this.findSymbolBreadthFirst(symbol.children, position, word);
                    if (child) { return child; }
                }
                if (symbol.name === word) {
                    return symbol;
                }
            }
        }
        return undefined;
    }

} 