import { parse, createVisitor, ParseError } from './java-ast';
import { TextDocument, Range, Position, SymbolKind } from 'vscode';
import { ClassVisitor } from './visitors/classVisitor';
import { EnumVisitor } from './visitors/enumVisitor';
import { InterfaceVisitor } from './visitors/interfaceVisitor';
import { AnnotationVisitor } from './visitors/annotationVisitor';
import { BaseVisitorContext } from './visitors/baseVisitor';

export interface ImportInfo {
    identifier: string;
    qualifiedName: string;
    range: Range;
}

export interface JavaFileInfo {
    modulePath: string;
    packageName: string;
    importInfos: ImportInfo[];
    typeSymbol: JavaSymbol;
    qualifiedName: string;
    symbols: JavaSymbol[];
    filePath: string;
    uri: string;
    errors?: ParseError[];
}

export interface JavaSymbol {
    name: string;
    typeName?: string;
    kind: SymbolKind;
    range: Range;
    children?: JavaSymbol[];
    identifierLocation?: Position;
    isConstructor?: boolean;
}

export class JavaAstParser {
    private document: TextDocument;

    constructor(document: TextDocument) {
        this.document = document;
    }

    private calculateModulePath(filePath: string, packageName: string): string {
        filePath = filePath.replaceAll('\\', '/').replace('src/main/java/', '');
        if (!packageName) {
            return filePath;
        }
        const packagePath = packageName.replace(/\./g, '/');
        const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (fileDir.endsWith(packagePath)) {
            return fileDir.substring(0, fileDir.length - packagePath.length);
        }
        return fileDir;
    }

    public parse(): JavaFileInfo {
        const text = this.document.getText();
        const { ast, errors } = parse(text);

        let packageName = '';
        const importInfos: ImportInfo[] = [];
        const symbols: JavaSymbol[] = [];

        const context: BaseVisitorContext = {
            document: this.document,
            symbols
        };

        const classVisitor = new ClassVisitor(context);
        const enumVisitor = new EnumVisitor(context);
        const interfaceVisitor = new InterfaceVisitor(context);
        const annotationVisitor = new AnnotationVisitor(context);

        const visitor = createVisitor({
            visitPackageDeclaration: (ctx) => {
                packageName = ctx.qualifiedName().text;
                return 1;
            },
            visitImportDeclaration: (ctx) => {
                const qualifiedName = ctx.children
                    .filter((child, index, arr) => {
                        if (index === 0 && child.text === 'import') return false;
                        if (index === arr.length - 1 && child.text === ';') return false;
                        return true;
                    }).map(child => child.text).join('');
                const start = new Position(ctx.start.line - 1, ctx.start.charPositionInLine);
                const end = new Position(ctx.stop.line - 1, ctx.stop.charPositionInLine + ctx.stop.text.length);
                importInfos.push({
                    identifier: qualifiedName.substring(qualifiedName.lastIndexOf('.') + 1),
                    qualifiedName: qualifiedName,
                    range: new Range(start, end)
                });
                return 1;
            }
        });

        visitor.visit(ast);
        classVisitor.createVisitor().visit(ast);
        enumVisitor.createVisitor().visit(ast);
        interfaceVisitor.createVisitor().visit(ast);
        annotationVisitor.createVisitor().visit(ast);

        const modulePath = this.calculateModulePath(this.document.uri.fsPath, packageName);
        const typeSymbol = symbols[0];

        if (!typeSymbol) return undefined;
        return {
            errors,
            modulePath,
            packageName,
            importInfos,
            typeSymbol,
            qualifiedName: `${packageName}.${typeSymbol.name}`,
            symbols,
            filePath: this.document.uri.fsPath,
            uri: this.document.uri.toString()
        };
    }
} 