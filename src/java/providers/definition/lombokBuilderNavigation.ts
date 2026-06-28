import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { Location, Position, Range, TextDocument, Uri } from 'vscode';
import { JavaFileInfo } from '../../parser/javaAstParser';
import {
    findBuilderRootTypeName,
    findFieldSymbol,
    hasBuilderAnnotation,
    parseAnnotationsOnLines,
} from '../completion/lombokSupport';
import { MemberFinder } from './memberFinder';

const BUILDER_SKIP_METHODS = new Set(['build', 'builder', 'toString']);

export class LombokBuilderNavigation {
    constructor(private memberFinder: MemberFinder) { }

    public resolveMember(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        word: string,
        position: Position,
    ): Location | undefined {
        if (BUILDER_SKIP_METHODS.has(word)) {
            return undefined;
        }

        const rootTypeName = findBuilderRootTypeName(document, position);
        if (!rootTypeName) {
            return undefined;
        }

        const classFileInfo = this.memberFinder.findClassFileInfo(fileInfo, rootTypeName);
        if (!classFileInfo) {
            return undefined;
        }

        if (!this.classHasBuilder(classFileInfo.filePath, classFileInfo.typeSymbol.range.start.line)) {
            return undefined;
        }

        const field = findFieldSymbol(classFileInfo.symbols, word);
        if (!field) {
            return undefined;
        }

        const start = field.identifierLocation ?? field.range.start;
        return new Location(
            Uri.file(classFileInfo.filePath),
            new Range(start, start),
        );
    }

    private classHasBuilder(filePath: string, classLine: number): boolean {
        if (!existsSync(filePath)) {
            return false;
        }
        const lines = readFileSync(filePath, 'utf8').split('\n');
        const annotations = parseAnnotationsOnLines(lines, classLine);
        return hasBuilderAnnotation(annotations);
    }
}
