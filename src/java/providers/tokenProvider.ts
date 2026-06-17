import { TextDocument, CancellationToken, ProviderResult, SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, DocumentSemanticTokensProvider } from 'vscode';
import { WorkspaceManager } from '../workspace/workspaceManager';

const legend = new SemanticTokensLegend(['this']);

export class JavaTokenProvider implements DocumentSemanticTokensProvider {
    constructor(private workspaceManager: WorkspaceManager) { }

    provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken): ProviderResult<SemanticTokens> {
        const builder = new SemanticTokensBuilder(legend);
        const text = document.getText();
        const thisRegex = /\bthis\b/g;
        let match;

        while ((match = thisRegex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);

            // 检查是否是 this. 的形式
            const nextChar = text[match.index + 4];
            if (nextChar === '.') {
                builder.push(startPos.line, startPos.character, match[0].length, 0, 0);
            }
        }

        return builder.build();
    }
} 