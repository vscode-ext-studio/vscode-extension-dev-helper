import { FoldingRange, FoldingRangeProvider, TextDocument, SymbolKind } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';
import { JavaSymbol } from '../parser/javaAstParser';

export class JavaFoldingProvider implements FoldingRangeProvider {
    constructor(private workspaceManager: WorkspaceManager) { }

    provideFoldingRanges(document: TextDocument): FoldingRange[] {
        const fileInfo = this.workspaceManager.getByDocument(document);
        if (!fileInfo) {
            return [];
        }

        const ranges: FoldingRange[] = [];

        // 添加import区域的折叠
        if (fileInfo.importInfos.length > 1) {
            const firstImport = fileInfo.importInfos[0];
            const lastImport = fileInfo.importInfos[fileInfo.importInfos.length - 1];
            ranges.push(new FoldingRange(
                firstImport.range.start.line,
                lastImport.range.end.line
            ));
        }

        // 添加类型定义和方法的折叠
        this.processSymbols(fileInfo.symbols, ranges);

        return ranges;
    }

    private processSymbols(symbols: JavaSymbol[], ranges: FoldingRange[]): void {
        for (const symbol of symbols) {
            // 添加类型定义的折叠（类、接口、枚举等）
            if ([SymbolKind.Class, SymbolKind.Interface, SymbolKind.Enum, SymbolKind.Class].includes(symbol.kind)) {
                ranges.push(new FoldingRange(
                    symbol.range.start.line,
                    symbol.range.end.line
                ));
            }

            // 添加方法的折叠
            if ([SymbolKind.Method, SymbolKind.Constructor].includes(symbol.kind)) {
                ranges.push(new FoldingRange(
                    symbol.range.start.line,
                    symbol.range.end.line
                ));
            }

            // 递归处理子元素
            if (symbol.children) {
                this.processSymbols(symbol.children, ranges);
            }
        }
    }
} 