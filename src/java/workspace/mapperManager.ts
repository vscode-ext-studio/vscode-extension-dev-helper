import { workspace, Uri, TextDocument } from 'vscode';
import { XMLParser } from 'fast-xml-parser';

interface MapperElement {
    id: string;
    line: number;
    column: number;
}

export interface MapperInfo {
    uri: Uri;
    elements: MapperElement[];
}

export class MapperManager {
    private mapperCache: { [key: string]: MapperInfo } = {};
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            isArray: (name, jpath) => {
                return name !== 'mapper';
            }
        });
    }

    public async initialize() {
        const workspaceFolders = workspace.workspaceFolders;
        if (!workspaceFolders) return;

        for (const folder of workspaceFolders) {
            await this.scanWorkspace(folder.uri);
        }
    }

    private async scanWorkspace(workspaceUri: Uri) {
        const workspacePath = workspaceUri.fsPath;
        const excludePatterns = ['**/target/**', '**/build/**', '**/out/**', '**/bin/**', '**/dist/**'];

        const files = await workspace.findFiles('**/*Mapper.xml', `{${excludePatterns.join(',')}}`);

        for (const file of files) {
            await this.parseMapperFile(file);
        }
        const cache = this.mapperCache;
        console.log('cache', cache);
    }

    private async parseMapperFile(fileUri: Uri) {
        try {
            const document = await workspace.openTextDocument(fileUri);
            const content = document.getText();
            const result = this.parser.parse(content);

            if (result.mapper) {
                const namespace = result.mapper['@_namespace'];
                if (namespace) {
                    const elements: MapperElement[] = [];

                    // 解析 mapper 下的所有子元素
                    for (const key in result.mapper) {
                        if (key !== '@_namespace' && Array.isArray(result.mapper[key])) {
                            const elementsArray = result.mapper[key];
                            for (const element of elementsArray) {
                                if (element['@_id']) {
                                    // 查找元素在文档中的位置
                                    const elementText = `<${key} id="${element['@_id']}"`;
                                    const startIndex = content.indexOf(elementText);
                                    if (startIndex !== -1) {
                                        const position = document.positionAt(startIndex);
                                        elements.push({
                                            id: element['@_id']?.[0],
                                            line: position.line + 1,
                                            column: position.character + 1
                                        });
                                    }
                                }
                            }
                        }
                    }

                    this.mapperCache[namespace] = {
                        uri: fileUri,
                        elements: elements
                    };
                }
            }
        } catch (error) {
            console.error(`Failed to parse mapper file ${fileUri.fsPath}:`, error);
        }
    }

    public getMapperInfo(namespace: string): MapperInfo | undefined {
        return this.mapperCache[namespace];
    }

    public async onDocumentChange(document: TextDocument) {
        if (document.fileName.endsWith('Mapper.xml')) {
            await this.parseMapperFile(document.uri);
        }
    }
} 