import { createVisitor } from '../../java-ast';
import { MemberVisitor } from './memberVisitor';
import { SymbolKind } from 'vscode';

export class FieldVisitor extends MemberVisitor {
    public createVisitor() {
        return createVisitor({
            visitFieldDeclaration: (ctx) => {
                const typeType = ctx.typeType();
                const typeName = typeType?.text || '';
                const variableDeclarators = ctx.variableDeclarators();
                for (const declarator of variableDeclarators.variableDeclarator()) {
                    const ctx = declarator.variableDeclaratorId();
                    const fieldSymbol = this.createSymbolWithType(SymbolKind.Field, ctx, typeName);
                    this.symbols.push(fieldSymbol);
                }
                return 1;
            },
            visitConstDeclaration: (ctx) => {
                const typeType = ctx.typeType();
                const typeName = typeType?.text || '';

                for (const declarator of ctx.constantDeclarator()) {
                    const fieldSymbol = this.createSymbolWithType(SymbolKind.Constant, declarator, typeName);
                    this.symbols.push(fieldSymbol);
                }
                return 1;
            }
        });
    }
} 