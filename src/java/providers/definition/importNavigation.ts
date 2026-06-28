import { TextDocument, Position, Location } from 'vscode';
import { JavaFileInfo } from '../../parser/javaAstParser';
import { ImportClassFinder } from './importClassFinder';
import { MemberFinder } from './memberFinder';

export function resolveImportDefinition(
    fileInfo: JavaFileInfo,
    document: TextDocument,
    position: Position,
    importClassFinder: ImportClassFinder,
    memberFinder?: MemberFinder,
): Location | undefined {
    const line = document.lineAt(position.line).text;
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) {
        return undefined;
    }

    const match = trimmed.match(/^import\s+(?:static\s+)?(.+?)\s*;/);
    if (!match) {
        return undefined;
    }

    const isStatic = /^import\s+static\s+/.test(trimmed);
    const importPath = match[1].trim();
    const pathStart = line.indexOf(importPath);
    if (pathStart === -1) {
        return undefined;
    }
    const pathEnd = pathStart + importPath.length;
    if (position.character < pathStart || position.character > pathEnd) {
        return undefined;
    }

    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }
    const word = document.getText(wordRange);

    if (importPath.endsWith('.*')) {
        const packageName = importPath.slice(0, -2);
        return importClassFinder.findImportedClass(fileInfo, `${packageName}.${word}`);
    }

    if (isStatic) {
        const parts = importPath.split('.');
        const last = parts[parts.length - 1];
        const isMemberImport = parts.length > 1 && /^[a-z_$]/.test(last);
        const classQualifiedName = isMemberImport ? parts.slice(0, -1).join('.') : importPath;

        if (isMemberImport && word === last && memberFinder) {
            const simpleClassName = classQualifiedName.substring(classQualifiedName.lastIndexOf('.') + 1);
            const memberLocation = memberFinder.findMember(fileInfo, last, simpleClassName);
            if (memberLocation) {
                return memberLocation;
            }
        }

        return importClassFinder.findImportedClass(fileInfo, classQualifiedName);
    }

    return importClassFinder.findImportedClass(fileInfo, importPath);
}
