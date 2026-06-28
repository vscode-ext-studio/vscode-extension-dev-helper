import { createVisitor, MethodDeclarationContext, ConstructorDeclarationContext, InterfaceCommonBodyDeclarationContext } from '../../java-ast';
import { JavaSymbol } from '../../javaAstParser';
import { MemberVisitor } from './memberVisitor';
import { SymbolKind } from 'vscode';
import { inferTypeFromVarInitializer } from '../../../providers/definition/typeNameUtils';

export class MethodVisitor extends MemberVisitor {

    public createVisitor() {
        return createVisitor({
            visitConstructorDeclaration: (ctx: ConstructorDeclarationContext) => {
                const constructorSymbol = this.createSymbolWithType(SymbolKind.Constructor, ctx, 'void');
                constructorSymbol.children = this.parseMethodParameters(ctx);
                this.symbols.push(constructorSymbol);
                return 1;
            },
            visitMethodDeclaration: (ctx) => {
                const returnType = ctx.typeTypeOrVoid();
                const typeName = returnType?.text || 'void';
                const methodSymbol = this.createSymbolWithType(SymbolKind.Method, ctx, typeName);
                methodSymbol.children = [
                    ...this.parseMethodParameters(ctx),
                    ...this.parseLocalVariables(ctx),
                    ...this.parseLoopVariables(ctx)
                ];
                this.symbols.push(methodSymbol);
                return 1;
            },
            visitInterfaceCommonBodyDeclaration: (ctx) => {
                const returnType = ctx.typeTypeOrVoid();
                const typeName = returnType?.text || 'void';
                const methodSymbol = this.createSymbolWithType(SymbolKind.Method, ctx, typeName);
                methodSymbol.children = this.parseMethodParameters(ctx);
                this.symbols.push(methodSymbol);
                return 1;
            },
            visitAnnotationMethodRest: (ctx) => {
                const methodSymbol = this.createSymbolWithType(SymbolKind.Method, ctx, 'void');
                methodSymbol.children = [];
                this.symbols.push(methodSymbol);
                return 1;
            }
        });
    }

    private parseMethodParameters(ctx: ConstructorDeclarationContext | MethodDeclarationContext | InterfaceCommonBodyDeclarationContext): JavaSymbol[] {
        const parameters: JavaSymbol[] = [];
        const formalParameters = ctx.formalParameters();
        if (formalParameters) {
            const parameterList = formalParameters.formalParameterList();
            if (parameterList) {
                for (const param of parameterList.formalParameter()) {
                    const typeType = param.typeType();
                    const typeName = typeType?.text || '';
                    const ctx = param.variableDeclaratorId();
                    const parameterSymbol = this.createSymbolWithType(SymbolKind.Variable, ctx, typeName);
                    parameters.push(parameterSymbol);
                }
            }
        }
        return parameters;
    }

    private parseLocalVariables(ctx: MethodDeclarationContext): JavaSymbol[] {
        const localVariables: JavaSymbol[] = [];
        const methodBody = ctx.methodBody();
        if (!methodBody) {
            return localVariables;
        }

        const visitor = createVisitor({
            visitLocalVariableDeclaration: (localVarCtx) => {
                const typeType = localVarCtx.typeType();
                let typeName = typeType?.text || '';
                const variableDeclarators = localVarCtx.variableDeclarators();
                if (variableDeclarators) {
                    for (const declarator of variableDeclarators.variableDeclarator()) {
                        const variableDeclaratorId = declarator.variableDeclaratorId();
                        if (!variableDeclaratorId) {
                            continue;
                        }
                        if (typeName === 'var') {
                            const initializer = declarator.variableInitializer();
                            if (initializer) {
                                const inferred = inferTypeFromVarInitializer(initializer.text);
                                if (inferred) {
                                    typeName = inferred;
                                }
                            }
                        }
                        const localVariableSymbol = this.createSymbolWithType(SymbolKind.Variable, variableDeclaratorId, typeName);
                        localVariables.push(localVariableSymbol);
                    }
                }
                return 1;
            }
        });
        visitor.visit(methodBody);
        return localVariables;
    }

    private parseLoopVariables(ctx: MethodDeclarationContext): JavaSymbol[] {
        const loopVariables: JavaSymbol[] = [];
        const methodBody = ctx.methodBody();
        if (methodBody) {
            const loopVisitor = createVisitor({
                visitEnhancedForControl: (ctx) => {
                    const typeType = ctx.typeType();
                    const typeName = typeType?.text || '';
                    const variableDeclaratorId = ctx.variableDeclaratorId();
                    if (variableDeclaratorId) {
                        const localVariableSymbol = this.createSymbolWithType(SymbolKind.Variable, variableDeclaratorId, typeName);
                        loopVariables.push(localVariableSymbol);
                    }
                    return 1;
                }
            });
            loopVisitor.visit(methodBody);
        }
        return loopVariables;
    }

} 