import {
  commands,
  ExtensionContext,
  ProgressLocation,
  Uri,
  window,
  workspace,
} from 'vscode'
import { readFile, writeFile } from 'fs/promises'
import * as path from 'path'

const TINIFY_API = 'https://api.tinify.com'

type CompressMode = 'overwrite' | 'suffix'

export function activateTinypng(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand(
      'extension.tinypng.compressOverwrite',
      (uri: Uri, uris?: Uri[]) => compressSelected(uri, uris, 'overwrite')
    ),
    commands.registerCommand(
      'extension.tinypng.compressWithSuffix',
      (uri: Uri, uris?: Uri[]) => compressSelected(uri, uris, 'suffix')
    )
  )
}

async function compressSelected(
  uri: Uri | undefined,
  uris: Uri[] | undefined,
  mode: CompressMode
): Promise<void> {
  const targets = resolveTargets(uri, uris)
  if (targets.length === 0) {
    window.showErrorMessage('请选择要压缩的 PNG 文件')
    return
  }

  const apiKey = workspace.getConfiguration('tinypng').get<string>('apiKey')?.trim()
  if (!apiKey) {
    const openSettings = '打开设置'
    const choice = await window.showErrorMessage(
      '请先在设置中配置 tinypng.apiKey（TinyPNG API Key）',
      openSettings
    )
    if (choice === openSettings) {
      await commands.executeCommand(
        'workbench.action.openSettings',
        'tinypng.apiKey'
      )
    }
    return
  }

  for (const target of targets) {
    if (!isPngUri(target)) {
      continue
    }
    await compressOne(target, mode, apiKey)
  }
}

function resolveTargets(uri: Uri | undefined, uris: Uri[] | undefined): Uri[] {
  if (uris && uris.length > 0) {
    return uris.filter(isPngUri)
  }
  if (uri && isPngUri(uri)) {
    return [uri]
  }
  const editor = window.activeTextEditor
  if (editor && isPngUri(editor.document.uri)) {
    return [editor.document.uri]
  }
  return []
}

function isPngUri(resource: Uri): boolean {
  return resource.fsPath.toLowerCase().endsWith('.png')
}

async function compressOne(
  uri: Uri,
  mode: CompressMode,
  apiKey: string
): Promise<void> {
  const filePath = uri.fsPath
  const fileName = path.basename(filePath)

  try {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `正在压缩 ${fileName}`,
        cancellable: false,
      },
      async () => {
        const originalBytes = await readFile(uri.fsPath)
        const originalSize = originalBytes.length
        const compressedBytes = await tinifyCompress(originalBytes, apiKey)
        const outputPath = resolveOutputPath(filePath, mode)
        await writeFile(outputPath, compressedBytes)
        const compressedSize = compressedBytes.length
        const saved = originalSize - compressedSize
        const savedPercent =
          originalSize > 0 ? ((saved / originalSize) * 100).toFixed(1) : '0'

        window.showInformationMessage(
          `PNG 已压缩：${path.basename(outputPath)} — ${formatSize(originalSize)} → ${formatSize(compressedSize)}（节省 ${formatSize(saved)}，${savedPercent}%）`
        )
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.showErrorMessage(`压缩失败 ${fileName}: ${message}`)
  }
}

function resolveOutputPath(filePath: string, mode: CompressMode): string {
  if (mode === 'overwrite') {
    return filePath
  }
  const suffix =
    workspace.getConfiguration('tinypng').get<string>('outputSuffix') ?? '-min'
  const dir = path.dirname(filePath)
  const base = path.basename(filePath, '.png')
  return path.join(dir, `${base}${suffix}.png`)
}

async function tinifyCompress(
  imageData: Buffer,
  apiKey: string
): Promise<Buffer> {
  const auth = Buffer.from(`api:${apiKey}`).toString('base64')

  const shrinkResponse = await fetch(`${TINIFY_API}/shrink`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: imageData,
  })

  if (!shrinkResponse.ok) {
    throw new Error(await parseApiError(shrinkResponse))
  }

  const outputUrl = shrinkResponse.headers.get('location')
  if (!outputUrl) {
    throw new Error('TinyPNG 未返回压缩结果地址')
  }

  const downloadResponse = await fetch(outputUrl, {
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!downloadResponse.ok) {
    throw new Error(await parseApiError(downloadResponse))
  }

  const arrayBuffer = await downloadResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    if (body.message) {
      return body.message
    }
    if (body.error) {
      return body.error
    }
  } catch {
    // ignore JSON parse errors
  }
  return `TinyPNG API 错误 (${response.status})`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
