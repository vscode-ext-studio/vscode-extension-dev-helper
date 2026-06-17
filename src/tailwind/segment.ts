const BACKSLASH = 0x5c
const OPEN_CURLY = 0x7b
const CLOSE_CURLY = 0x7d
const OPEN_PAREN = 0x28
const CLOSE_PAREN = 0x29
const OPEN_BRACKET = 0x5b
const CLOSE_BRACKET = 0x5d
const DOUBLE_QUOTE = 0x22
const SINGLE_QUOTE = 0x27

const closingBracketStack = new Uint8Array(256)

export function segment(input: string, separator: string): string[] {
  let stackPos = 0
  const parts: string[] = []
  let lastPos = 0
  const len = input.length
  const separatorCode = separator.charCodeAt(0)

  for (let idx = 0; idx < len; idx++) {
    const char = input.charCodeAt(idx)

    if (stackPos === 0 && char === separatorCode) {
      parts.push(input.slice(lastPos, idx))
      lastPos = idx + 1
      continue
    }

    switch (char) {
      case BACKSLASH:
        idx += 1
        break
      case SINGLE_QUOTE:
      case DOUBLE_QUOTE:
        while (++idx < len) {
          const nextChar = input.charCodeAt(idx)
          if (nextChar === BACKSLASH) {
            idx += 1
            continue
          }
          if (nextChar === char) {
            break
          }
        }
        break
      case OPEN_PAREN:
        closingBracketStack[stackPos] = CLOSE_PAREN
        stackPos++
        break
      case OPEN_BRACKET:
        closingBracketStack[stackPos] = CLOSE_BRACKET
        stackPos++
        break
      case OPEN_CURLY:
        closingBracketStack[stackPos] = CLOSE_CURLY
        stackPos++
        break
      case CLOSE_BRACKET:
      case CLOSE_CURLY:
      case CLOSE_PAREN:
        if (stackPos > 0 && char === closingBracketStack[stackPos - 1]) {
          stackPos--
        }
        break
    }
  }

  parts.push(input.slice(lastPos))
  return parts
}
