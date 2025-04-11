import { existsSync } from 'fs';
import { resolve } from 'path';
import { Definition, DefinitionLink, DefinitionProvider, Position, ProviderResult, Range, TextDocument, Uri, workspace } from 'vscode';

export class DependencyLinkProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position): ProviderResult<Definition | DefinitionLink[]> {
        let shouldCheckForDependency: boolean = false;
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (shouldCheckForDependency) {
                if (line.text.includes('}')) {
                    shouldCheckForDependency = false;
                } else {
                    const matches = line.text.match(/"(.*?)"/);
                    if (matches) {
                        const packageName = matches[1];
                        const startCharacter = line.text.indexOf(packageName);
                        const endCharacter = startCharacter + packageName.length;

                        if (position.line === i &&
                            position.character >= startCharacter &&
                            position.character <= endCharacter) {
                            const originSelectionRange = new Range(i, startCharacter, i, endCharacter);
                            const targetUri = this.getTargetUri(document, packageName);
                            if (targetUri) {
                                return [{
                                    originSelectionRange,
                                    targetUri,
                                    targetRange: new Range(0, 0, 0, 0),
                                    targetSelectionRange: new Range(0, 0, 0, 0)
                                }];
                            }
                        }
                    }
                }
            } else {
                shouldCheckForDependency = /"(\w*?)dependencies"/i.test(line.text);
            }
        }
        return undefined;
    }

    private getTargetUri(document: TextDocument, packageName: string): Uri | undefined {
        const basePathList = [
            workspace.rootPath,
            resolve(document.uri.fsPath, '..')
        ];

        for (const item of basePathList) {
            const dependencyPath = resolve(item, 'node_modules', packageName, 'package.json');
            if (existsSync(dependencyPath)) {
                return Uri.file(dependencyPath);
            }
        }

        // 如果本地找不到，返回 npm 网站的位置
        return Uri.parse(`https://www.npmjs.com/package/${packageName}`);
    }
}