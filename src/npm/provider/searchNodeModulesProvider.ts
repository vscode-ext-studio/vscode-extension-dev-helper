import { existsSync, readdirSync, statSync } from 'fs';
import { basename, format, join, resolve } from 'path';
import { ThemeIcon, Uri, window, workspace, QuickPickItem, QuickPickItemKind, ExtensionContext, commands } from 'vscode';

export function activateSearchNodeModules(context: ExtensionContext) {
    const nodeModulesPath = 'node_modules';
    const fileIcon = Uri.file(join(context.extensionPath, 'icons', 'file.svg'))
    const folderIcon = Uri.file(join(context.extensionPath, 'icons', 'folder.svg'))
    const packageIcon = Uri.file(join(context.extensionPath, 'icons', 'nodejs.svg'))
    return commands.registerCommand('npm.jumper.search', async (option: Uri) => {
        const searchPath = async (workspaceName: string, workspaceRoot: string, folderPath: string) => {
            const folderFullPath = join(workspaceRoot, folderPath);
            const files = sortFiles(folderFullPath,
                readdirSync(folderFullPath).filter(file => !file.startsWith('.'))
            );
            const workspaceNodeModules = join(workspaceName, nodeModulesPath);
            const isParentFolder = folderPath.includes('..');
            if (folderPath != nodeModulesPath) {
                files.push('');
                files.push(workspaceNodeModules);
                if (!isParentFolder) {
                    files.push('..');
                }
            }
            const items = files.map(name => {
                const isPackageJson = name === 'package.json';
                const filePath = join(folderFullPath, name);
                let iconPath: Uri | ThemeIcon = null;
                if (isPackageJson) iconPath = packageIcon;
                else if (name == '..') iconPath = new ThemeIcon('arrow-left')
                else if (existsSync(filePath)) {
                    iconPath = statSync(join(folderFullPath, name)).isDirectory() ? folderIcon : fileIcon;
                } else {
                    iconPath = new ThemeIcon('home'); // Root node_modules
                }
                return {
                    label: name,
                    kind: name == '' ? QuickPickItemKind.Separator : undefined,
                    iconPath, picked: isPackageJson,
                } as QuickPickItem;
            });
            const item = await window.showQuickPick(items, {
                placeHolder: format({ dir: workspaceName, base: folderPath })
            });
            if (!item) return;
            const selected = item.label;
            // node_modules shortcut selected
            if (selected === workspaceNodeModules) {
                searchPath(workspaceName, workspaceRoot, nodeModulesPath);
            } else {
                const selectedPath = join(folderPath, selected);
                const selectedFullPath = join(workspaceRoot, selectedPath);
                // If selected is a folder, traverse it,
                // otherwise open file.
                const stats = statSync(selectedFullPath);
                if (stats.isDirectory()) {
                    searchPath(workspaceName, workspaceRoot, selectedPath);
                } else {
                    const doc = await workspace.openTextDocument(selectedFullPath);
                    window.showTextDocument(doc);
                }
            }
        };

        if (option instanceof Uri) {
            const path = resolve(option.fsPath, '..');
            return searchPath(basename(path), path, nodeModulesPath);
        }

        const getWorkspaceFolder = async () => {
            const folders = workspace.workspaceFolders;
            if (folders?.length > 1) {
                const selected = await window.showQuickPick(
                    folders.map(folder => ({ label: folder.name, folder })),
                    { placeHolder: 'Select workspace folder' }
                );
                if (!selected) return;
                return selected.folder;
            }
            return folders[0];
        };

        if (!workspace.workspaceFolders?.length) {
            return window.showErrorMessage('You must have a workspace opened.')
        }

        const folder = await getWorkspaceFolder();
        if (folder) {
            const name = folder.name;
            const path = folder.uri.fsPath;
            searchPath(name, path, nodeModulesPath);
        }
    })

}

const sortFiles = (folderPath: string, files: string[]): string[] => {
    return files
        .map(file => {
            const fullPath = `${folderPath}/${file}`;
            return { name: file, isDirectory: statSync(fullPath).isDirectory() };
        })
        .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        })
        .map(file => file.name);
};