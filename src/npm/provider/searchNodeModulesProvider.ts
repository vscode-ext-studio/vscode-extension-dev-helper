import { existsSync, readdirSync, statSync } from 'fs'
import { basename, format, join, resolve } from 'path'
import {
  ThemeIcon,
  Uri,
  window,
  workspace,
  QuickPickItem,
  QuickPickItemKind,
  ExtensionContext,
  commands,
} from 'vscode'

const NODE_MODULES = 'node_modules'

export function activateSearchNodeModules(context: ExtensionContext) {
  const fileIcon = Uri.file(join(context.extensionPath, 'icons', 'file.svg'))
  const folderIcon = Uri.file(join(context.extensionPath, 'icons', 'folder.svg'))
  const packageIcon = Uri.file(join(context.extensionPath, 'icons', 'nodejs.svg'))

  return commands.registerCommand('npm.jumper.search', async (option?: Uri) => {
    const searchPath = async (workspaceName: string, workspaceRoot: string, folderPath: string) => {
      const folderFullPath = join(workspaceRoot, folderPath)
      const files = listNodeModuleEntries(folderFullPath)
      const workspaceNodeModules = join(workspaceName, NODE_MODULES)
      const isParentFolder = folderPath.includes('..')

      if (folderPath !== NODE_MODULES) {
        files.push('')
        files.push(workspaceNodeModules)
        if (!isParentFolder) {
          files.push('..')
        }
      }

      const items = files.map((name) => {
        const isPackageJson = name === 'package.json'
        const filePath = join(folderFullPath, name)
        let iconPath: Uri | ThemeIcon | undefined

        if (isPackageJson) {
          iconPath = packageIcon
        } else if (name === '..') {
          iconPath = new ThemeIcon('arrow-left')
        } else if (existsSync(filePath)) {
          iconPath = statSync(filePath).isDirectory() ? folderIcon : fileIcon
        } else {
          iconPath = new ThemeIcon('home')
        }

        return {
          label: name,
          kind: name === '' ? QuickPickItemKind.Separator : undefined,
          iconPath,
          picked: isPackageJson,
        } as QuickPickItem
      })

      const item = await window.showQuickPick(items, {
        placeHolder: format({ dir: workspaceName, base: folderPath }),
      })
      if (!item) {
        return
      }

      const selected = item.label
      if (selected === workspaceNodeModules) {
        await searchPath(workspaceName, workspaceRoot, NODE_MODULES)
        return
      }

      const selectedPath = join(folderPath, selected)
      const selectedFullPath = join(workspaceRoot, selectedPath)
      const stats = statSync(selectedFullPath)
      if (stats.isDirectory()) {
        await searchPath(workspaceName, workspaceRoot, selectedPath)
      } else {
        const doc = await workspace.openTextDocument(selectedFullPath)
        await window.showTextDocument(doc)
      }
    }

    if (option instanceof Uri) {
      const path = resolve(option.fsPath, '..')
      return searchPath(basename(path), path, NODE_MODULES)
    }

    if (!workspace.workspaceFolders?.length) {
      return window.showErrorMessage('You must have a workspace opened.')
    }

    const folder = await getWorkspaceFolder()
    if (folder) {
      await searchPath(folder.name, folder.uri.fsPath, NODE_MODULES)
    }
  })
}

async function getWorkspaceFolder() {
  const folders = workspace.workspaceFolders
  if (!folders?.length) {
    return undefined
  }
  if (folders.length > 1) {
    const selected = await window.showQuickPick(
      folders.map((folder) => ({ label: folder.name, folder })),
      { placeHolder: 'Select workspace folder' },
    )
    return selected?.folder
  }
  return folders[0]
}

function listNodeModuleEntries(folderFullPath: string): string[] {
  const expandScoped = basename(folderFullPath) === NODE_MODULES
  const entries: string[] = []
  for (const name of readdirSync(folderFullPath)) {
    if (name.startsWith('.')) {
      continue
    }
    const entryPath = join(folderFullPath, name)
    if (!existsSync(entryPath)) {
      continue
    }
    if (expandScoped && name.startsWith('@') && statSync(entryPath).isDirectory()) {
      for (const pkg of readdirSync(entryPath)) {
        if (pkg.startsWith('.')) {
          continue
        }
        const pkgPath = join(entryPath, pkg)
        if (existsSync(pkgPath) && statSync(pkgPath).isDirectory()) {
          entries.push(`${name}/${pkg}`)
        }
      }
      continue
    }
    entries.push(name)
  }
  return sortEntries(folderFullPath, entries)
}

function sortEntries(folderPath: string, entries: string[]): string[] {
  const sorted: { name: string; isDirectory: boolean }[] = []
  for (const name of entries) {
    const fullPath = join(folderPath, name)
    sorted.push({
      name,
      isDirectory: existsSync(fullPath) && statSync(fullPath).isDirectory(),
    })
  }
  sorted.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
  const names: string[] = []
  for (const entry of sorted) {
    names.push(entry.name)
  }
  return names
}
