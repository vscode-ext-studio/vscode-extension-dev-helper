import { createVisitor } from '../java-ast';
import { JavaSymbol } from '../javaAstParser';
import { BaseVisitorContext, createBaseSymbol } from './baseVisitor';
import { MethodVisitor } from './members/methodVisitor';
import { FieldVisitor } from './members/fieldVisitor';
import { EnumConstantVisitor } from './members/enumConstantVisitor';
import { SymbolKind } from 'vscode';

export class EnumVisitor {
    private context: BaseVisitorContext;
    private methodVisitor: MethodVisitor;
    private fieldVisitor: FieldVisitor;
    private enumConstantVisitor: EnumConstantVisitor;

    constructor(context: BaseVisitorContext) {
        this.context = context;
        this.methodVisitor = new MethodVisitor(context);
        this.fieldVisitor = new FieldVisitor(context);
        this.enumConstantVisitor = new EnumConstantVisitor(context);
    }

    public createVisitor() {
        return createVisitor({
            visitEnumDeclaration: (ctx) => {
                const enumSymbol = {
                    ...createBaseSymbol(SymbolKind.Enum, ctx, this.context.document),
                    children: []
                } as JavaSymbol;

                this.context.symbols.push(enumSymbol);

                const enumConstants = ctx.enumConstants();
                if (enumConstants) {
                    const enumConstantsSymbols = this.parseEnumConstants(enumConstants);
                    enumSymbol.children.push(...enumConstantsSymbols);
                }

                const enumBody = ctx.enumBodyDeclarations();
                if (enumBody) {
                    const enumBodySymbols = this.parseEnumBody(enumBody);
                    enumSymbol.children.push(...enumBodySymbols);
                }
                return 1;
            }
        });
    }

    private parseEnumConstants(enumConstants: any): JavaSymbol[] {
        const visitor = this.enumConstantVisitor.createVisitor();
        visitor.visit(enumConstants);
        return this.enumConstantVisitor.getSymbols();
    }

    private parseEnumBody(enumBody: any): JavaSymbol[] {
        const methodVisitor = this.methodVisitor.createVisitor();
        const fieldVisitor = this.fieldVisitor.createVisitor();

        methodVisitor.visit(enumBody);
        fieldVisitor.visit(enumBody);

        return [
            ...this.methodVisitor.getSymbols(),
            ...this.fieldVisitor.getSymbols()
        ];
    }
}

