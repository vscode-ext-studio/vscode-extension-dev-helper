import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatHex, formatHex8, parse } from 'culori'
import { __unstable__loadDesignSystem } from 'tailwindcss'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.resolve(__dirname, '../src/tailwind/data/tailwind-default.json')
const tailwindCssPath = new URL('../node_modules/tailwindcss/index.css', import.meta.url)

const COLOR_PROPS = [
  'accent-color',
  'caret-color',
  'color',
  'column-rule-color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'fill',
  'outline-color',
  'stop-color',
  'stroke',
  'text-decoration-color',
  '--tw-ring-color',
  '--tw-shadow-color',
  '--tw-gradient-from',
  '--tw-gradient-to',
  '--tw-gradient-via',
]

const css = fs.readFileSync(tailwindCssPath, 'utf8')
const themeVars = new Map()
for (const match of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  themeVars.set(`--${match[1]}`, match[2].trim())
}

function resolveVar(value) {
  const match = /^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/.exec(value.trim())
  if (!match) {
    return value
  }
  const resolved = themeVars.get(match[1])
  if (resolved) {
    return resolved
  }
  return match[2]?.trim() ?? value
}

function resolveColorValue(value) {
  const keyword = value.trim().toLowerCase()
  if (keyword === 'transparent' || keyword === 'currentcolor') {
    return null
  }

  let working = value.trim()

  const mixMatch = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)$/i.exec(working)
  if (mixMatch) {
    const base = toHex(resolveVar(mixMatch[1].trim()))
    if (!base) {
      return null
    }
    const parsed = parse(base)
    if (!parsed) {
      return null
    }
    parsed.alpha = Number(mixMatch[2]) / 100
    return parsed.alpha === 1 ? formatHex(parsed) : formatHex8(parsed)
  }

  if (working.startsWith('var(')) {
    working = resolveVar(working)
  }

  return toHex(working)
}

function toHex(value) {
  const parsed = parse(value)
  if (!parsed) {
    return null
  }
  return parsed.alpha === undefined || parsed.alpha === 1
    ? formatHex(parsed)
    : formatHex8(parsed)
}

function extractColorFromCss(ruleCss) {
  const colors = []
  for (const prop of COLOR_PROPS) {
    const regex = new RegExp(`(?:^|[\\s{])${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`, 'm')
    const match = regex.exec(ruleCss)
    if (!match) {
      continue
    }
    const value = match[1].trim()
    if (value.includes('--tw-') && !prop.startsWith('--tw-')) {
      continue
    }
    const hex = resolveColorValue(value)
    if (hex) {
      colors.push(hex)
    }
  }

  if (colors.length === 0) {
    return null
  }

  const unique = [...new Set(colors)]
  return unique.length === 1 ? unique[0] : null
}

function formatCssPreview(ruleCss) {
  if (!ruleCss) {
    return null
  }
  const body = ruleCss.replace(/^[^\{]+\{\s*/, '').replace(/\}\s*$/, '').trim()
  return body || null
}

/** 仅保留常用交互态 pseudo-class variant，用于补全与解析 */
const INTERACTION_PSEUDO_VARIANTS = new Set([
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'visited',
  'disabled',
  'checked',
])

/** v4 新增 utility 大类，补全中排除（class 名包含即排除） */
const V4_NEW_UTILITY_KEYWORDS = [
  'mask',
  'inset-shadow',
  'inset-ring',
  'text-shadow',
  'field-sizing',
  'font-stretch',
  'scheme',
  'bg-linear',
  'bg-conic',
  'bg-radial',
  'rotate-x',
  'rotate-y',
  'rotate-z',
  'scale-z',
  'translate-z',
  'transform-3d',
  'backface',
  'perspective-origin',
  'perspective-distant',
  'perspective-dramatic',
  'perspective-midrange',
  'perspective-near',
  'perspective-normal',
  'transition-discrete',
]

/** 少用的 v3 utility 大类，补全中排除（class 名包含即排除） */
const RARE_V3_UTILITY_KEYWORDS = [
  'inset',
  'float',
  'clear',
  'isolation',
  'mix-blend',
  'bg-blend',
  'caption',
  'break-before',
  'break-after',
  'break-inside',
  'hyphens',
  'indent',
  'snap',
  'touch',
  'overscroll',
  'will-change',
  'appearance',
  'resize',
  'table',
  'border-collapse',
  'border-spacing',
  'columns',
  'scroll',
  'grid-flow',
  'auto-cols',
  'auto-rows',
  'justify-items',
  'justify-self',
  'place-content',
  'place-items',
  'place-self',
  'list-image',
  'list-inside',
  'list-outside',
  'list-item',
  'invert',
  'hue-rotate',
  'saturate',
  'sepia',
  'brightness',
  'contrast',
  'grayscale',
  'shadow',
  'translate',
  'backdrop',
  '@'
]

/** Tailwind 默认色板名（用于识别含颜色的 class） */
const TAILWIND_COLOR_NAMES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]

/** 补全中保留的常用色板 */
const COMMON_COLOR_NAMES = new Set([
  'gray',
  'slate',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'blue',
  'white',
  'black',
])

function isTextOrBgClass(className) {
  return /^-?(text|bg)-/.test(className)
}

function usesPaletteColor(className) {
  for (const name of TAILWIND_COLOR_NAMES) {
    if (className.includes(name)) {
      return true
    }
  }
  return className.includes('white') || className.includes('black')
}

/** 非 text/bg 的颜色 utility（border-red-500、from-blue-500 等） */
function isOtherColorClass(className) {
  return usesPaletteColor(className) && !isTextOrBgClass(className)
}

/** text/bg 中使用非常用色板的 class */
function isNonCommonColorClass(className) {
  if (!isTextOrBgClass(className)) {
    return false
  }
  for (const name of TAILWIND_COLOR_NAMES) {
    if (!COMMON_COLOR_NAMES.has(name) && className.includes(name)) {
      return true
    }
  }
  return false
}

/** 减号开头只保留上下左右定位偏移 */
const ALLOWED_NEGATIVE_DIRECTION = /^-(?:top|bottom|left|right)-/

function isDisallowedNegativeClass(className) {
  if (!className.startsWith('-')) {
    return false
  }
  return !ALLOWED_NEGATIVE_DIRECTION.test(className)
}

function isExcludedUtility(className) {
  for (const keyword of V4_NEW_UTILITY_KEYWORDS) {
    if (className.includes(keyword)) {
      return true
    }
  }
  for (const keyword of RARE_V3_UTILITY_KEYWORDS) {
    if (className.includes(keyword)) {
      return true
    }
  }
  return false
}

const design = await __unstable__loadDesignSystem(css)
const classList = design.getClassList()
const allClassNames = classList.map(([name]) => name)
const classes = allClassNames
  .filter((name) => !isExcludedUtility(name) && !isOtherColorClass(name) && !isNonCommonColorClass(name) && !isDisallowedNegativeClass(name))
  .sort()

const colors = {}
const styles = {}
for (const className of classes) {
  const ruleCss = design.candidatesToCss([className])[0]
  if (!ruleCss) {
    continue
  }
  const preview = formatCssPreview(ruleCss)
  if (preview) {
    styles[className] = preview
  }
  if (!isTextOrBgClass(className)) {
    continue
  }
  const hex = extractColorFromCss(ruleCss)
  if (hex) {
    colors[className] = hex
  }
}

const variants = []
for (const variant of design.getVariants()) {
  if (variant.values.length === 0) {
    if (INTERACTION_PSEUDO_VARIANTS.has(variant.name)) {
      variants.push(variant.name)
    }
    continue
  }
  for (const value of variant.values) {
    const name = value === 'DEFAULT'
      ? variant.name
      : `${variant.name}${variant.hasDash ? '-' : ''}${value}`
    if (INTERACTION_PSEUDO_VARIANTS.has(name)) {
      variants.push(name)
    }
  }
}
variants.sort()

const data = { version: '4', classes, variants, colors, styles }
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(data))
console.log(`Generated ${classes.length} classes (${allClassNames.length - classes.length} excluded), ${variants.length} variants, ${Object.keys(colors).length} colors, ${Object.keys(styles).length} styles`)
