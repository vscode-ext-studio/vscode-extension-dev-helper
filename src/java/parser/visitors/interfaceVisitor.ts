import { createVisitor, InterfaceBodyContext } from '../java-ast';
import { JavaSymbol } from '../javaAstParser';
import { BaseVisitorContext, createBaseSymbol } from './baseVisitor';
import { MethodVisitor } from './members/methodVisitor';
import { FieldVisitor } from './members/fieldVisitor';
import { SymbolKind } from 'vscode';

export class InterfaceVisitor {
    private context: BaseVisitorContext;
    private methodVisitor: MethodVisitor;
    private fieldVisitor: FieldVisitor;

    constructor(context: BaseVisitorContext) {
        this.context = context;
        this.methodVisitor = new MethodVisitor(context);
        this.fieldVisitor = new FieldVisitor(context);
    }

    public createVisitor() {
        return createVisitor({
            visitInterfaceDeclaration: (ctx) => {
                const interfaceSymbol = {
                    ...createBaseSymbol(SymbolKind.Interface, ctx, this.context.document),
                    children: []
                } as JavaSymbol;

                this.context.symbols.push(interfaceSymbol);

                // 访问接口体，收集方法
                const interfaceBody = ctx.interfaceBody();
                if (interfaceBody) {
                    const interfaceBodySymbols = this.parseInterfaceBody(interfaceBody);
                    interfaceSymbol.children = interfaceBodySymbols;
                }
                return 1;
            }
        });
    }

    private parseInterfaceBody(interfaceBody: InterfaceBodyContext): JavaSymbol[] {
        const methodVisitor = this.methodVisitor.createVisitor();
        const fieldVisitor = this.fieldVisitor.createVisitor();

        methodVisitor.visit(interfaceBody);
        fieldVisitor.visit(interfaceBody);

        return [
            ...this.methodVisitor.getSymbols(),
            ...this.fieldVisitor.getSymbols()
        ];
    }
} 