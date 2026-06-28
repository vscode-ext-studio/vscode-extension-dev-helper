import { JavaFileInfo, JavaSymbol } from '../../parser/javaAstParser';
import { SymbolKind } from 'vscode';
import { extractSimpleTypeName } from './typeNameUtils';

const BASE_MAPPER_PATTERN = /(?:[\w.]+\.)?BaseMapper\s*<\s*([\w.]+)\s*>/;
const SERVICE_IMPL_PATTERN = /(?:[\w.]+\.)?ServiceImpl\s*<\s*([\w.]+)\s*,\s*([\w.]+)\s*>/;

/** BaseMapper 中返回实体类型 T 的查询方法 */
const BASE_MAPPER_ENTITY_RETURN_METHODS = new Set([
    'selectById',
    'selectOne',
    'selectBatchIds',
    'selectByMap',
    'selectList',
    'selectPage',
]);

/** IService / ServiceImpl 中返回 Mapper 的方法 */
const MAPPER_RETURN_METHODS = new Set([
    'getBaseMapper',
]);

/** IService 中返回实体类型 T 的常用方法 */
const SERVICE_ENTITY_RETURN_METHODS = new Set([
    'getById',
    'getOne',
    'listByIds',
    'listByMap',
    'list',
    'page',
    'save',
    'saveOrUpdate',
    'saveOrUpdateBatch',
    'saveBatch',
    'updateById',
    'removeById',
]);

export interface MybatisPlusTypes {
    mapperType?: string;
    entityType?: string;
}

export function extractEntityTypeFromBaseMapper(typeText: string): string | undefined {
    const match = typeText.match(BASE_MAPPER_PATTERN);
    return match?.[1];
}

export function extractServiceImplTypes(typeText: string): MybatisPlusTypes | undefined {
    const match = typeText.match(SERVICE_IMPL_PATTERN);
    if (!match) {
        return undefined;
    }
    return {
        mapperType: match[1],
        entityType: match[2],
    };
}

export function isBaseMapperEntityReturnMethod(methodName: string): boolean {
    return BASE_MAPPER_ENTITY_RETURN_METHODS.has(methodName);
}

export function isMapperReturnMethod(methodName: string): boolean {
    return MAPPER_RETURN_METHODS.has(methodName);
}

export function isServiceEntityReturnMethod(methodName: string): boolean {
    return SERVICE_ENTITY_RETURN_METHODS.has(methodName);
}

export function findMybatisPlusGenericAtPosition(line: string, character: number): string | undefined {
    const serviceImplPattern = new RegExp(SERVICE_IMPL_PATTERN.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = serviceImplPattern.exec(line)) !== null) {
        for (const typeName of [match[1], match[2]]) {
            const typeStart = match.index + match[0].indexOf(typeName);
            const typeEnd = typeStart + typeName.length;
            if (character >= typeStart && character < typeEnd) {
                return typeName;
            }
        }
    }

    const baseMapperPattern = new RegExp(BASE_MAPPER_PATTERN.source, 'g');
    while ((match = baseMapperPattern.exec(line)) !== null) {
        const entityName = match[1];
        const entityStart = match.index + match[0].indexOf(entityName);
        const entityEnd = entityStart + entityName.length;
        if (character >= entityStart && character < entityEnd) {
            return entityName;
        }
    }

    return undefined;
}

export function resolveServiceImplTypes(classFileInfo: JavaFileInfo | undefined): MybatisPlusTypes | undefined {
    if (!classFileInfo?.typeSymbol) {
        return undefined;
    }
    const { mapperType, entityType } = classFileInfo.typeSymbol;
    if (mapperType) {
        return { mapperType, entityType };
    }
    return undefined;
}

export function resolveEntityTypeFromMapperFile(mapperFileInfo: JavaFileInfo | undefined): string | undefined {
    if (!mapperFileInfo) {
        return undefined;
    }
    for (const symbol of mapperFileInfo.symbols) {
        if (symbol.kind === SymbolKind.Interface && symbol.entityType) {
            return symbol.entityType;
        }
    }
    return undefined;
}

export function resolveMapperType(
    typeName: string,
    classFileInfo: JavaFileInfo | undefined
): string | undefined {
    const serviceImplTypes = resolveServiceImplTypes(classFileInfo);
    if (serviceImplTypes?.mapperType) {
        return serviceImplTypes.mapperType;
    }

    const fromBaseMapper = extractEntityTypeFromBaseMapper(typeName);
    if (fromBaseMapper) {
        return undefined;
    }

    const simple = extractSimpleTypeName(typeName);
    if (classFileInfo && simple.endsWith('Mapper')) {
        return simple;
    }

    return undefined;
}

export function resolveEntityType(
    typeName: string,
    classFileInfo: JavaFileInfo | undefined,
    mapperFileInfo: JavaFileInfo | undefined
): string | undefined {
    const serviceImplTypes = resolveServiceImplTypes(classFileInfo);
    if (serviceImplTypes?.entityType) {
        return serviceImplTypes.entityType;
    }

    const fromBaseMapper = extractEntityTypeFromBaseMapper(typeName);
    if (fromBaseMapper) {
        return fromBaseMapper;
    }

    if (serviceImplTypes?.mapperType && mapperFileInfo) {
        const entityFromMapper = resolveEntityTypeFromMapperFile(mapperFileInfo);
        if (entityFromMapper) {
            return entityFromMapper;
        }
    }

    return resolveEntityTypeFromMapperFile(mapperFileInfo);
}
