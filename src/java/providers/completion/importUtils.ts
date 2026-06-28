import { TextDocument, Position, TextEdit } from 'vscode';
import { JavaFileInfo } from '../../parser/javaAstParser';

export function isImportRequired(fileInfo: JavaFileInfo, qualifiedName: string): boolean {
    const simpleName = qualifiedName.substring(qualifiedName.lastIndexOf('.') + 1);

    if (fileInfo.qualifiedName === qualifiedName) {
        return false;
    }

    if (fileInfo.packageName) {
        const samePackageName = `${fileInfo.packageName}.${simpleName}`;
        if (samePackageName === qualifiedName) {
            return false;
        }
    }

    if (simpleName === qualifiedName && fileInfo.packageName) {
        return false;
    }

    for (const importInfo of fileInfo.importInfos) {
        if (importInfo.qualifiedName === qualifiedName) {
            return false;
        }
        if (importInfo.identifier === simpleName && importInfo.qualifiedName.endsWith(`.${simpleName}`)) {
            return false;
        }
        if (importInfo.identifier === '*') {
            const packagePrefix = importInfo.qualifiedName.replace(/\.\*$/, '');
            if (qualifiedName.startsWith(`${packagePrefix}.`)) {
                return false;
            }
        }
    }

    return true;
}

export function findImportInsertPosition(document: TextDocument): Position {
    let lastImportLine = -1;
    let packageLine = -1;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text.trim();
        if (line.startsWith('package ')) {
            packageLine = i;
        } else if (line.startsWith('import ')) {
            lastImportLine = i;
        } else if (line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
            if (lastImportLine >= 0 || packageLine >= 0) {
                break;
            }
        }
    }

    if (lastImportLine >= 0) {
        return new Position(lastImportLine + 1, 0);
    }
    if (packageLine >= 0) {
        return new Position(packageLine + 1, 0);
    }
    return new Position(0, 0);
}

export function createImportEdit(document: TextDocument, qualifiedName: string): TextEdit {
    const position = findImportInsertPosition(document);
    return TextEdit.insert(position, `import ${qualifiedName};\n`);
}
