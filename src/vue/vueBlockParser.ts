export type VueBlockTag = 'template' | 'style'

export interface VueBlock {
  tag: VueBlockTag
  contentStart: number
  contentEnd: number
}

const BLOCK_REGEX = /<(template|style)\b[^>]*>([\s\S]*?)<\/\1>/g

export function parseVueBlocks(text: string): VueBlock[] {
  const blocks: VueBlock[] = []
  let match: RegExpExecArray | null
  while ((match = BLOCK_REGEX.exec(text)) !== null) {
    const tag = match[1] as VueBlockTag
    const openTagEnd = match.index + match[0].indexOf('>') + 1
    const closeTagStart = match.index + match[0].length - `</${tag}>`.length
    blocks.push({
      tag,
      contentStart: openTagEnd,
      contentEnd: closeTagStart,
    })
  }
  return blocks
}

export function getBlockAtOffset(blocks: VueBlock[], offset: number): VueBlock | undefined {
  for (const block of blocks) {
    if (offset >= block.contentStart && offset < block.contentEnd) {
      return block
    }
  }
  return undefined
}
