import { TextDocument } from 'vscode';
import { JavaSymbol } from '../../parser/javaAstParser';
import { SymbolKind } from 'vscode';

export type MemberVisibility = 'public' | 'protected' | 'private' | 'package';

export function parseMemberVisibility(document: TextDocument, symbol: JavaSymbol): MemberVisibility {
    for (let i = symbol.range.start.line; i >= Math.max(0, symbol.range.start.line - 5); i--) {
        const text = document.lineAt(i).text;
        if (/\bprivate\b/.test(text)) {
            return 'private';
        }
        if (/\bprotected\b/.test(text)) {
            return 'protected';
        }
        if (/\bpublic\b/.test(text)) {
            return 'public';
        }
        if (i < symbol.range.start.line) {
            const trimmed = text.trim();
            if (trimmed.length > 0 && !trimmed.startsWith('@') && /[;{}]/.test(trimmed)) {
                break;
            }
        }
    }
    return 'package';
}

export function isVisibleForMemberCompletion(
    symbol: JavaSymbol,
    visibility: MemberVisibility,
    allowPrivateAccess: boolean,
): boolean {
    if (allowPrivateAccess) {
        return true;
    }

    if (visibility === 'private') {
        return false;
    }

    if (symbol.kind === SymbolKind.Field || symbol.kind === SymbolKind.Constant) {
        return visibility !== 'private';
    }

    return true;
}
