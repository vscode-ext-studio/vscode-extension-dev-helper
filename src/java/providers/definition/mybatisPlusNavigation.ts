import { TextDocument, Range, Location, Position } from 'vscode';
import { JavaFileInfo } from '../../parser/javaAstParser';
import { ImportClassFinder } from './importClassFinder';
import { MemberFinder } from './memberFinder';
import { SymbolFinder } from './symbolFinder';
import {
    findMybatisPlusGenericAtPosition,
    isBaseMapperEntityReturnMethod,
    isMapperReturnMethod,
    isServiceEntityReturnMethod,
    resolveEntityType,
    resolveMapperType,
    resolveServiceImplTypes,
} from './mybatisPlusResolver';

export class MybatisPlusNavigation {
    constructor(
        private importClassFinder: ImportClassFinder,
        private memberFinder: MemberFinder,
        private symbolFinder: SymbolFinder,
    ) { }

    public resolveGenericAtPosition(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        position: { line: number; character: number }
    ): Location | undefined {
        const line = document.lineAt(position.line).text;
        const genericType = findMybatisPlusGenericAtPosition(line, position.character);
        if (genericType) {
            return this.importClassFinder.findImportedClass(fileInfo, genericType);
        }
        return undefined;
    }

    public resolveIdentifier(fileInfo: JavaFileInfo, word: string): Location | undefined {
        if (word !== 'baseMapper') {
            return undefined;
        }
        const mapperType = resolveMapperType(fileInfo.typeSymbol.name, fileInfo);
        if (mapperType) {
            return this.importClassFinder.findImportedClass(fileInfo, mapperType);
        }
        return undefined;
    }

    public resolveMember(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        wordRange: Range,
        word: string
    ): Location | undefined {
        const objectContext = this.resolveObjectContext(fileInfo, document, wordRange);
        if (!objectContext) {
            return undefined;
        }

        const { objectClassFile, objectTypeName } = objectContext;
        const serviceImplTypes = resolveServiceImplTypes(objectClassFile);

        if (isMapperReturnMethod(word) || word === 'baseMapper') {
            const mapperType = resolveMapperType(objectTypeName, objectClassFile);
            if (mapperType) {
                return this.importClassFinder.findImportedClass(fileInfo, mapperType);
            }
            return undefined;
        }

        if (isServiceEntityReturnMethod(word) && serviceImplTypes?.entityType) {
            return this.importClassFinder.findImportedClass(fileInfo, serviceImplTypes.entityType);
        }

        if (isBaseMapperEntityReturnMethod(word)) {
            const mapperType = resolveMapperType(objectTypeName, objectClassFile) || serviceImplTypes?.mapperType;
            const mapperFileInfo = mapperType
                ? this.memberFinder.findClassFileInfo(fileInfo, mapperType)
                : this.memberFinder.findClassFileInfo(fileInfo, objectTypeName);
            const entityType = resolveEntityType(objectTypeName, objectClassFile, mapperFileInfo);
            if (entityType) {
                return this.importClassFinder.findImportedClass(fileInfo, entityType);
            }
        }

        return undefined;
    }

    private resolveObjectContext(
        fileInfo: JavaFileInfo,
        document: TextDocument,
        wordRange: Range
    ): { objectClassFile: JavaFileInfo; objectTypeName: string } | undefined {
        const objectNameRange = document.getWordRangeAtPosition(
            new Position(wordRange.start.line, wordRange.start.character - 2)
        );
        if (!objectNameRange) {
            return undefined;
        }

        const objectName = document.getText(objectNameRange);
        if (objectName === 'this' || objectName === 'baseMapper') {
            if (objectName === 'this' || resolveServiceImplTypes(fileInfo)) {
                return {
                    objectClassFile: fileInfo,
                    objectTypeName: fileInfo.typeSymbol.name,
                };
            }
        }

        const objectSymbol = this.symbolFinder.findSymbolAtPosition(fileInfo, objectNameRange.start, objectName);
        const objectTypeName = objectSymbol?.typeName || objectName;
        const objectClassFile = this.memberFinder.findClassFileInfo(fileInfo, objectTypeName) || fileInfo;
        return { objectClassFile, objectTypeName };
    }
}
