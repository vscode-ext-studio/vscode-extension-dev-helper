import { TextDocument } from 'vscode';
import { JavaFileInfo, JavaSymbol } from '../../parser/javaAstParser';
import { SymbolKind } from 'vscode';

export interface CompletionMember {
    name: string;
    kind: SymbolKind;
    typeName?: string;
    detail?: string;
    isSynthetic?: boolean;
}

const GETTER_ANNOTATIONS = new Set(['Getter', 'Data', 'Value']);
const SETTER_ANNOTATIONS = new Set(['Setter', 'Data']);
const BUILDER_ANNOTATIONS = new Set(['Builder']);

export function parseAnnotationsOnLine(document: TextDocument, line: number): Set<string> {
    const annotations = new Set<string>();
    for (let i = line; i >= Math.max(0, line - 8); i--) {
        const text = document.lineAt(i).text.trim();
        if (!text.startsWith('@') && annotations.size > 0) {
            break;
        }
        if (text.length === 0) {
            continue;
        }
        if (!text.startsWith('@') && !text.includes('@')) {
            if (annotations.size > 0) {
                break;
            }
            continue;
        }
        const matches = text.matchAll(/@(?:[\w.]+\.)?(\w+)/g);
        for (const match of matches) {
            annotations.add(match[1]);
        }
        if (!text.startsWith('@')) {
            break;
        }
    }
    return annotations;
}

function hasAnyAnnotation(annotations: Set<string>, names: Set<string>): boolean {
    for (const name of names) {
        if (annotations.has(name)) {
            return true;
        }
    }
    return false;
}

function capitalize(name: string): string {
    if (!name) {
        return name;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function isBooleanType(typeName?: string): boolean {
    if (!typeName) {
        return false;
    }
    const simple = typeName.replace(/\[\s*\]/g, '').trim();
    return simple === 'boolean' || simple === 'Boolean';
}

function isFieldFinal(document: TextDocument, field: JavaSymbol): boolean {
    const line = document.lineAt(field.range.start.line).text;
    return /\bfinal\b/.test(line);
}

function buildGetterName(field: JavaSymbol): string {
    const name = field.name;
    if (isBooleanType(field.typeName)) {
        if (name.startsWith('is') && name.length > 2 && /[A-Z]/.test(name[2])) {
            return name;
        }
        return `is${capitalize(name)}`;
    }
    return `get${capitalize(name)}`;
}

function buildSetterName(field: JavaSymbol): string {
    const name = field.name;
    if (isBooleanType(field.typeName) && name.startsWith('is') && name.length > 2) {
        return `set${name.substring(2)}`;
    }
    return `set${capitalize(name)}`;
}

function collectFields(symbols: JavaSymbol[], fields: JavaSymbol[]): void {
    for (const symbol of symbols) {
        if (symbol.kind === SymbolKind.Field || symbol.kind === SymbolKind.Constant) {
            fields.push(symbol);
        }
        if (symbol.children) {
            collectFields(symbol.children, fields);
        }
    }
}

function collectDeclaredMethods(symbols: JavaSymbol[], names: Set<string>): void {
    for (const symbol of symbols) {
        if (symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Constructor) {
            names.add(symbol.name);
        }
        if (symbol.children) {
            collectDeclaredMethods(symbol.children, names);
        }
    }
}

export function generateLombokMembers(fileInfo: JavaFileInfo, document: TextDocument): CompletionMember[] {
    const classSymbol = fileInfo.typeSymbol;
    if (!classSymbol || classSymbol.kind !== SymbolKind.Class) {
        return [];
    }

    const classAnnotations = parseAnnotationsOnLine(document, classSymbol.range.start.line);
    const classHasGetter = hasAnyAnnotation(classAnnotations, GETTER_ANNOTATIONS);
    const classHasSetter = hasAnyAnnotation(classAnnotations, SETTER_ANNOTATIONS);
    const classHasBuilder = hasAnyAnnotation(classAnnotations, BUILDER_ANNOTATIONS);

    const fields: JavaSymbol[] = [];
    collectFields(fileInfo.symbols, fields);

    const declaredMethods = new Set<string>();
    collectDeclaredMethods(fileInfo.symbols, declaredMethods);

    const members: CompletionMember[] = [];
    const added = new Set<string>();

    const addMethod = (name: string, typeName: string | undefined, detail: string) => {
        if (declaredMethods.has(name) || added.has(name)) {
            return;
        }
        added.add(name);
        members.push({
            name,
            kind: SymbolKind.Method,
            typeName,
            detail,
            isSynthetic: true,
        });
    };

    for (const field of fields) {
        const fieldAnnotations = parseAnnotationsOnLine(document, field.range.start.line);
        const hasGetter = classHasGetter || hasAnyAnnotation(fieldAnnotations, GETTER_ANNOTATIONS);
        const hasSetter = (classHasSetter || hasAnyAnnotation(fieldAnnotations, SETTER_ANNOTATIONS))
            && !isFieldFinal(document, field)
            && field.kind !== SymbolKind.Constant;

        if (hasGetter) {
            const getterName = buildGetterName(field);
            addMethod(getterName, field.typeName, `() → ${field.typeName || 'void'}`);
        }
        if (hasSetter) {
            const setterName = buildSetterName(field);
            addMethod(setterName, 'void', `(${field.typeName})`);
        }
    }

    if (classHasBuilder && !declaredMethods.has('builder') && !added.has('builder')) {
        members.push({
            name: 'builder',
            kind: SymbolKind.Method,
            typeName: `${classSymbol.name}Builder`,
            detail: '()',
            isSynthetic: true,
        });
    }

    return members;
}
