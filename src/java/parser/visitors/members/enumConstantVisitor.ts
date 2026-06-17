import { createVisitor } from '../../java-ast';
import { MemberVisitor } from './memberVisitor';
import { SymbolKind } from 'vscode';

export class EnumConstantVisitor extends MemberVisitor {

    public createVisitor() {
        return createVisitor({
            visitEnumConstant: (ctx) => {
                const enumConstantSymbol = this.createSymbolWithType(SymbolKind.EnumMember, ctx, '');
                enumConstantSymbol.children = [];
                this.symbols.push(enumConstantSymbol);
                return 1;
            }
        });
    }

}