import { workspace, TextDocument, TextDocumentChangeEvent } from 'vscode';
import { JavaFileCache } from './javaFileCache';
import { JavaAstParser, JavaFileInfo } from '../parser/javaAstParser';

export class WorkspaceManager {
    private cache: JavaFileCache;

    constructor() {
        this.cache = new JavaFileCache();
    }

    public async initializeWorkspace(): Promise<void> {
        console.log('Initializing workspace, scanning Java files...');
        const startTime = Date.now();
        const javaFiles = await workspace.findFiles('**/*.java');
        console.log(`Found ${javaFiles.length} Java files, starting parsing...`);
        for (const file of javaFiles) {
            const document = await workspace.openTextDocument(file);
            try {
                this.updateCacheForDocument(document);
            } catch (error) {
                console.error(`Error parsing ${file.fsPath}: ${error}`);
            }
        }
        console.log(`Workspace initialization completed in ${Date.now() - startTime}ms`);
    }

    public updateCacheForDocument(document: TextDocument): JavaFileInfo {
        const parser = new JavaAstParser(document);
        const fileInfo = parser.parse();
        if (!fileInfo) {
            return undefined;
        }
        const filePath = document.uri.fsPath;

        this.cache.set(filePath, fileInfo.modulePath, fileInfo.qualifiedName, fileInfo);
        return fileInfo;
    }

    public onDocumentChange(event: TextDocumentChangeEvent): void {
        if (event.document.languageId === 'java') {
            this.updateCacheForDocument(event.document);
        }
    }

    public get(modulePath: string, qualifiedName: string): JavaFileInfo | undefined {
        return this.cache.get(modulePath, qualifiedName);
    }

    public getByDocument(document: TextDocument): JavaFileInfo | undefined {
        const filePath = document.uri.fsPath;
        let info = this.cache.getByFilePath(filePath);
        if (!info) {
            info = this.updateCacheForDocument(document);
        }
        return info;
    }
} 