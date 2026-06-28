import { TextDocument, Position } from 'vscode';

export interface MemberCompletionContext {
    kind: 'member';
    receiver: string;
    prefix: string;
}

export interface ImportCompletionContext {
    kind: 'import';
    prefix: string;
}

export interface GeneralCompletionContext {
    kind: 'general';
    prefix: string;
}

export type CompletionContext = MemberCompletionContext | ImportCompletionContext | GeneralCompletionContext;

export function getCompletionContext(document: TextDocument, position: Position): CompletionContext {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);

    const importMatch = textBefore.match(/^\s*import\s+(?:static\s+)?([\w.]*)$/);
    if (importMatch) {
        return { kind: 'import', prefix: importMatch[1] };
    }

    const memberMatch = textBefore.match(/((?:\w+\.)*\w+)\.(\w*)$/);
    if (memberMatch) {
        return {
            kind: 'member',
            receiver: memberMatch[1],
            prefix: memberMatch[2],
        };
    }

    const wordRange = document.getWordRangeAtPosition(position);
    const prefix = wordRange ? document.getText(wordRange) : '';
    return { kind: 'general', prefix };
}
