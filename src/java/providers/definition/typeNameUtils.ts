export function extractSimpleTypeName(typeName: string): string {
    let name = typeName.trim();
    if (!name) {
        return name;
    }

    name = name.replace(/@\w+(\([^)]*\))?/g, '').trim();

    const genericStart = name.indexOf('<');
    if (genericStart !== -1) {
        name = name.substring(0, genericStart).trim();
    }

    return name.replace(/\[\s*\]/g, '').trim();
}

export function isQualifiedTypeName(typeName: string): boolean {
    return extractSimpleTypeName(typeName).includes('.');
}

export function inferTypeFromVarInitializer(initializerText: string): string | undefined {
    const newMatch = initializerText.match(/new\s+([\w.]+)\s*[<(]/);
    if (newMatch) {
        return newMatch[1];
    }
    return undefined;
}
