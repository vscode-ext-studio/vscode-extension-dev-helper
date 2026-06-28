import { JavaFileInfo } from '../../parser/javaAstParser';
import { WorkspaceManager } from '../../workspace/workspaceManager';
import { Location, Uri, Range, Position } from 'vscode';
import { extractSimpleTypeName, isQualifiedTypeName } from './typeNameUtils';

export class ImportClassFinder {
    constructor(private workspaceManager: WorkspaceManager) { }

    public findImportedClass(fileInfo: JavaFileInfo, typeName: string): Location | undefined {
        const trimmed = typeName.trim();
        if (!trimmed) {
            return undefined;
        }

        if (isQualifiedTypeName(trimmed)) {
            const directMatch = this.workspaceManager.get(fileInfo.modulePath, trimmed);
            if (directMatch) {
                return this.createLocation(directMatch);
            }
        }

        const identifier = extractSimpleTypeName(trimmed);
        if (!identifier) {
            return undefined;
        }

        for (const importInfo of fileInfo.importInfos) {
            const isWildcardImport = importInfo.identifier === '*';
            if (importInfo.identifier === identifier || isWildcardImport) {
                const qualifiedName = isWildcardImport ? importInfo.qualifiedName.replace(/\*/g, identifier) : importInfo.qualifiedName;
                const importedFileInfo = this.workspaceManager.get(fileInfo.modulePath, qualifiedName);
                if (importedFileInfo) {
                    return this.createLocation(importedFileInfo);
                }
            }
        }

        if (fileInfo.packageName) {
            const samePackageType = `${fileInfo.packageName}.${identifier}`;
            const samePackageFileInfo = this.workspaceManager.get(fileInfo.modulePath, samePackageType);
            if (samePackageFileInfo) {
                return this.createLocation(samePackageFileInfo);
            }
        }

        const javaLangType = `java.lang.${identifier}`;
        const javaLangFileInfo = this.workspaceManager.get(fileInfo.modulePath, javaLangType);
        if (javaLangFileInfo) {
            return this.createLocation(javaLangFileInfo);
        }

        return undefined;
    }

    private createLocation(fileInfo: JavaFileInfo): Location {
        const startPos = fileInfo.typeSymbol.identifierLocation;
        const endPos = new Position(
            startPos.line,
            startPos.character + fileInfo.typeSymbol.name.length
        );
        return new Location(
            Uri.file(fileInfo.filePath),
            new Range(startPos, endPos)
        );
    }
} 