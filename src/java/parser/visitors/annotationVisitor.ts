import { AnnotationTypeBodyContext, createVisitor } from '../java-ast';
import { JavaSymbol } from '../javaAstParser';
import { BaseVisitorContext, createBaseSymbol } from './baseVisitor';
import { MethodVisitor } from './members/methodVisitor';
import { SymbolKind } from 'vscode';

export class AnnotationVisitor {
    private context: BaseVisitorContext;
    private methodVisitor: MethodVisitor;

    constructor(context: BaseVisitorContext) {
        this.context = context;
        this.methodVisitor = new MethodVisitor(context);
    }

    public createVisitor() {
        return createVisitor({
            visitAnnotationTypeDeclaration: (ctx) => {
                const annotationSymbol = {
                    ...createBaseSymbol(SymbolKind.Interface, ctx, this.context.document),
                    children: []
                } as JavaSymbol;

                this.context.symbols.push(annotationSymbol);

                // 访问注解体，收集注解元素
                const annotationBody = ctx.annotationTypeBody();
                if (annotationBody) {
                    const annotationBodySymbols = this.parseAnnotationBody(annotationBody);
                    annotationSymbol.children = annotationBodySymbols;
                }
                return 1;
            }
        });
    }

    private parseAnnotationBody(annotationBody: AnnotationTypeBodyContext): JavaSymbol[] {
        const methodVisitor = this.methodVisitor.createVisitor();
        methodVisitor.visit(annotationBody);
        return this.methodVisitor.getSymbols();
    }
} 