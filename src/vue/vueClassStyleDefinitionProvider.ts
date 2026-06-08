import {
  Definition,
  DefinitionLink,
  DefinitionProvider,
  Position,
  ProviderResult,
  TextDocument,
} from 'vscode'
import { getBlockAtOffset, parseVueBlocks } from './vueBlockParser'
import {
  findClassAtCursorInStyle,
  findClassAtCursorInTemplate,
  findClassSelectorInStyle,
  findClassUsagesInTemplate,
} from './vueClassNavigation'

export class VueClassStyleDefinitionProvider implements DefinitionProvider {
  provideDefinition(
    document: TextDocument,
    position: Position,
  ): ProviderResult<Definition | DefinitionLink[]> {
    const offset = document.offsetAt(position)
    const blocks = parseVueBlocks(document.getText())
    const block = getBlockAtOffset(blocks, offset)
    if (!block) {
      return undefined
    }

    if (block.tag === 'template') {
      return this.provideFromTemplate(document, offset, block, blocks)
    }

    if (block.tag === 'style') {
      return this.provideFromStyle(document, offset, block, blocks)
    }

    return undefined
  }

  private provideFromTemplate(
    document: TextDocument,
    offset: number,
    templateBlock: ReturnType<typeof getBlockAtOffset>,
    blocks: ReturnType<typeof parseVueBlocks>,
  ): DefinitionLink[] | undefined {
    if (!templateBlock) {
      return undefined
    }

    const classToken = findClassAtCursorInTemplate(document, offset, templateBlock)
    if (!classToken) {
      return undefined
    }

    for (const styleBlock of blocks) {
      if (styleBlock.tag !== 'style') {
        continue
      }
      const selector = findClassSelectorInStyle(document, classToken.name, styleBlock)
      if (selector) {
        return [{
          originSelectionRange: classToken.range,
          targetUri: document.uri,
          targetRange: selector.range,
          targetSelectionRange: selector.range,
        }]
      }
    }

    return undefined
  }

  private provideFromStyle(
    document: TextDocument,
    offset: number,
    styleBlock: ReturnType<typeof getBlockAtOffset>,
    blocks: ReturnType<typeof parseVueBlocks>,
  ): DefinitionLink[] | undefined {
    if (!styleBlock) {
      return undefined
    }

    const classToken = findClassAtCursorInStyle(document, offset, styleBlock)
    if (!classToken) {
      return undefined
    }

    const links: DefinitionLink[] = []
    for (const block of blocks) {
      if (block.tag !== 'template') {
        continue
      }
      const usages = findClassUsagesInTemplate(document, classToken.name, block)
      for (const usage of usages) {
        links.push({
          originSelectionRange: classToken.range,
          targetUri: document.uri,
          targetRange: usage.range,
          targetSelectionRange: usage.range,
        })
      }
    }

    return links.length > 0 ? links : undefined
  }
}
