import * as ts from 'typescript'

export const findNodeAtPosition = (source: ts.SourceFile, character: number): ts.Node | undefined => {
  const matchingNodes: INode[] = []
  source.statements.forEach(visitNode)
  const sortedNodes = matchingNodes.sort((a, b) => {
    if (a.width !== b.width) {
      return a.width - b.width; // 升序排列宽度
    }
    return b.depth - a.depth; // 降序排列深度
  })

  if (sortedNodes.length > 0) {
    return sortedNodes[0].node
  }

  function visitNode(node: ts.Node, depth = 0) {
    const start = node.getStart(source)
    const end = node.getEnd()
    const isToken = ts.isToken(node) && !ts.isIdentifier(node) && !ts.isTypeNode(node) && !isStringLiteral(node)

    if (!isToken && start <= character && character < end) {
      matchingNodes.push({
        depth,
        node,
        width: end - start
      })
    }

    node.getChildren(source).forEach(n => visitNode(n, depth + 1))
  }
}

export const isAssignmentBinaryExpression = (node: ts.BinaryExpression) => {
  return [
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    // Bitwise assignments
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.LessThanLessThanToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    // relatively new
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
  ].includes(node.operatorToken.kind)
}

export const isStringLiteral = (node: ts.Node) => {
  return ts.isTemplateSpan(node) || ts.isStringLiteralLike(node)
    || (ts.isExpressionStatement(node) && ts.isStringLiteralLike(node.expression))
}

interface INode {
  width: number
  depth: number
  node: ts.Node
}
