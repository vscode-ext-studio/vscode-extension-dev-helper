import { existsSync, readdirSync, statSync } from 'fs';
import { basename, format, join, resolve } from 'path';
import * as vscode from 'vscode';
import { ThemeIcon, Uri, languages } from 'vscode';
import { sortFiles } from './util/sort-files';
import { showError } from './util/utils';
import { DependencyLinkProvider } from './provider/dependencyLinkProvider';
import { activateOutdated } from './outdated/extension';

export function activateNpmDependencyCheck(context: vscode.ExtensionContext) {
    activateOutdated(context);
    context.subscriptions.push(
        languages.registerDocumentLinkProvider(['javascript', { pattern: '**/package.json' }], new DependencyLinkProvider())
    );
    const fileIcon = Uri.file(join(context.extensionPath, 'icons', 'file.svg'))
    const folderIcon = Uri.file(join(context.extensionPath, 'icons', 'folder.svg'))
    const packageIcon = Uri.file(join(context.extensionPath, 'icons', 'nodejs.svg'))

    const searchNodeModules = vscode.commands.registerCommand('npm.jumper.search', (option: Uri) => {
        const nodeModulesPath = 'node_modules';
        const searchPath = async (workspaceName: string, workspaceRoot: string, folderPath: string) => {
            const folderFullPath = join(workspaceRoot, folderPath);
            const files = sortFiles(folderFullPath,
                readdirSync(folderFullPath).filter(file => !file.startsWith('.'))
            )
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
                    kind: name == '' ? vscode.QuickPickItemKind.Separator : undefined,
                    iconPath, picked: isPackageJson,
                } as vscode.QuickPickItem
            });
            vscode.window.showQuickPick(items, {
                placeHolder: format({ dir: workspaceName, base: folderPath })

            }).then(item => {
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
                    const stats = statSync(selectedFullPath)
                    if (stats.isDirectory()) {
                        searchPath(workspaceName, workspaceRoot, selectedPath);
                    } else {
                        vscode.workspace.openTextDocument(selectedFullPath)
                            .then(vscode.window.showTextDocument);
                    }
                }
            });
        };

        if (option instanceof Uri) {
            const path = resolve(option.fsPath, '..');
            return searchPath(basename(path), path, nodeModulesPath);
        }

        const getWorkspaceFolder = async () => {
            const folders = vscode.workspace.workspaceFolders
            if (folders?.length > 1) {
                const selected = await vscode.window.showQuickPick(
                    folders.map(folder => ({ label: folder.name, folder })),
                    { placeHolder: 'Select workspace folder' }
                );
                if (!selected) return;
                return selected.folder;
            }
            return folders[0];
        };

        if (!vscode.workspace.workspaceFolders?.length) {
            return showError('You must have a workspace opened.');
        }

        getWorkspaceFolder().then(folder => {
            if (folder) {
                const name = folder.name;
                const path = folder.uri.fsPath
                searchPath(name, path, nodeModulesPath);
            }
        });
    });

    context.subscriptions.push(searchNodeModules);
};

export function deactivate() { }