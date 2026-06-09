import { existsSync } from 'fs'
import {
  commands,
  ExtensionContext,
  FileType,
  Uri,
  window,
  workspace,
} from 'vscode'

export function activateCreateDateMarkdown(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand(
      'extension.explorer.createDateMarkdown',
      (uri?: Uri) => createDateMarkdown(uri)
    )
  )
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function createDateMarkdown(uri?: Uri): Promise<void> {
  let targetDir: Uri | undefined

  if (uri) {
    const stat = await workspace.fs.stat(uri)
    if (stat.type !== FileType.Directory) {
      return
    }
    targetDir = uri
  } else {
    const folders = workspace.workspaceFolders
    if (!folders || folders.length === 0) {
      window.showErrorMessage('请先打开一个工作区文件夹')
      return
    }
    targetDir = folders[0].uri
  }

  const fileName = `${formatLocalDate(new Date())}.md`
  const fileUri = Uri.joinPath(targetDir, fileName)
  if (!existsSync(fileUri.fsPath)) {
    const content = `# ${formatLocalDate(new Date())}\n`
    await workspace.fs.writeFile(fileUri, new TextEncoder().encode(content))
  }

  await commands.executeCommand('vscode.open', fileUri)
}
