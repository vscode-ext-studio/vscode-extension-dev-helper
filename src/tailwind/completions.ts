import { CompletionItem, CompletionItemKind, Position, Range } from 'vscode'
import tailwindData from './data/tailwind-default.json'
import { getVariantsFromClassName } from './classContext'

const CLASS_SEPARATOR = ':'
const variantNames = new Set<string>(tailwindData.variants)
const classColors = tailwindData.colors as Record<string, string>

/** 补全排序：普通工具类 > 伪类 > 颜色类 > 减号开头工具类 */
const SORT_PRIORITY = {
  utility: 0,
  variant: 1,
  color: 2,
  negative: 3,
} as const

function buildSortText(priority: number, order: number): string {
  return `${priority}-${String(order).padStart(5, '0')}`
}

function getClassSortPriority(className: string, hasColor: boolean): number {
  if (className.startsWith('-')) {
    return SORT_PRIORITY.negative
  }
  if (hasColor) {
    return SORT_PRIORITY.color
  }
  return SORT_PRIORITY.utility
}

export interface ClassListInput {
  classList: string
  position: Position
}

function createVariantItems(
  existingVariants: string[],
  utilityPart: string,
  position: Position,
): CompletionItem[] {
  const items: CompletionItem[] = []
  const variantRange = new Range(
    new Position(
      position.line,
      position.character - (utilityPart.length > 0 ? utilityPart.length : 0),
    ),
    position,
  )

  let order = 0
  for (const variant of tailwindData.variants) {
    if (existingVariants.includes(variant)) {
      continue
    }
    if (utilityPart && !variant.startsWith(utilityPart)) {
      continue
    }

    const label = `${variant}${CLASS_SEPARATOR}`
    const item = new CompletionItem(label, CompletionItemKind.Enum)
    item.insertText = label
    item.range = variantRange
    item.sortText = buildSortText(SORT_PRIORITY.variant, order++)
    item.command = {
      title: '',
      command: 'editor.action.triggerSuggest',
    }
    items.push(item)
  }

  return items
}

export function completionsFromClassList(input: ClassListInput): CompletionItem[] {
  const { classList, position } = input
  const classNames = classList.split(/[\s+]/)
  const partialClassName = classNames[classNames.length - 1] ?? ''

  const { variants: existingVariants, offset } = getVariantsFromClassName(
    partialClassName,
    variantNames,
  )

  let important = false
  let utilityPart = partialClassName.slice(offset)
  if (utilityPart.startsWith('!')) {
    important = true
    utilityPart = utilityPart.slice(1)
  }

  const replacementRange = new Range(
    new Position(
      position.line,
      position.character - partialClassName.length + offset + (important ? 1 : 0),
    ),
    position,
  )

  const variantPrefix = existingVariants.length > 0
    ? `${existingVariants.join(CLASS_SEPARATOR)}${CLASS_SEPARATOR}`
    : ''

  const items: CompletionItem[] = []

  if (!important) {
    for (const variantItem of createVariantItems(
      existingVariants,
      utilityPart,
      position,
    )) {
      items.push(variantItem)
    }
  }

  const classOrderByPriority = [0, 0, 0, 0]
  for (const className of tailwindData.classes) {
    if (utilityPart && !className.startsWith(utilityPart)) {
      continue
    }

    const label = `${important ? '!' : ''}${variantPrefix}${className}`
    const color = classColors[className]
    const item = new CompletionItem(
      color
        ? { label, description: color }
        : label,
      color ? CompletionItemKind.Color : CompletionItemKind.Constant,
    )
    item.insertText = label
    item.range = replacementRange
    const priority = getClassSortPriority(className, color !== undefined)
    item.sortText = buildSortText(priority, classOrderByPriority[priority]++)
    if (color) {
      item.documentation = color
    }
    items.push(item)
  }

  return items
}
