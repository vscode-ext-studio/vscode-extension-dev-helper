import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import {
    Disposable,
    EventEmitter,
    ExtensionContext,
    FileChangeType,
    FileStat,
    FileSystemError,
    FileSystemProvider,
    FileType,
    Location,
    Position,
    Range,
    Uri,
    workspace,
} from 'vscode';

export const JDK_SRC_SCHEME = 'jdk-src';

export interface JdkSourceRef {
    zipPath: string;
    entryPath: string;
}

const contentCache = new Map<string, string>();

function cacheKey(zipPath: string, entryPath: string): string {
    return `${zipPath}\0${entryPath}`;
}

function encodePayload(zipPath: string, entryPath: string): string {
    return Buffer.from(`${zipPath}\0${entryPath}`, 'utf8').toString('base64url');
}

function decodePayload(payload: string): JdkSourceRef | undefined {
    try {
        const decoded = Buffer.from(payload, 'base64url').toString('utf8');
        const separator = decoded.indexOf('\0');
        if (separator === -1) {
            return undefined;
        }
        return {
            zipPath: decoded.slice(0, separator),
            entryPath: decoded.slice(separator + 1),
        };
    } catch {
        return undefined;
    }
}

/** payload 放在 authority，path 仅保留文件名（用于语法高亮与标签页显示） */
export function createJdkSourceUri(zipPath: string, entryPath: string): Uri {
    const payload = encodePayload(zipPath, entryPath);
    const fileName = entryPath.split('/').pop() ?? 'Source.java';
    return Uri.from({
        scheme: JDK_SRC_SCHEME,
        authority: payload,
        path: `/${fileName}`,
    });
}

export function parseJdkSourceUri(uri: Uri): JdkSourceRef | undefined {
    if (uri.scheme !== JDK_SRC_SCHEME) {
        return undefined;
    }

    if (uri.authority) {
        const ref = decodePayload(uri.authority);
        if (ref) {
            return ref;
        }
    }

    const path = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
    if (!path) {
        return undefined;
    }

    const tildeIndex = path.lastIndexOf('~');
    if (tildeIndex > 0) {
        const ref = decodePayload(path.slice(0, tildeIndex));
        if (ref) {
            return ref;
        }
    }

    const slashIndex = path.indexOf('/');
    if (slashIndex > 0) {
        const ref = decodePayload(path.slice(0, slashIndex));
        if (ref) {
            return { zipPath: ref.zipPath, entryPath: path.slice(slashIndex + 1) };
        }
    }

    const ref = decodePayload(path);
    if (ref) {
        return ref;
    }

    return undefined;
}

export function readZipEntry(zipPath: string, entryPath: string): string {
    const key = cacheKey(zipPath, entryPath);
    const cached = contentCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    if (!existsSync(zipPath)) {
        throw new Error(`JDK source archive not found: ${zipPath}`);
    }

    const content = execFileSync('unzip', ['-p', zipPath, entryPath], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
    });
    contentCache.set(key, content);
    return content;
}

export function findTypeDeclarationPosition(content: string, typeName: string): Position {
    const escapedName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b(?:class|interface|enum|record|@interface)\\s+(${escapedName})\\b`);
    const lines = content.split('\n');

    for (let line = 0; line < lines.length; line++) {
        const match = lines[line].match(pattern);
        if (match && match.index !== undefined && match[1] !== undefined) {
            const typeStart = match.index + match[0].indexOf(match[1]);
            return new Position(line, typeStart);
        }
    }

    return new Position(0, 0);
}

export function createJdkSourceLocation(
    zipPath: string,
    entryPath: string,
    qualifiedName: string,
): Location {
    const typeName = qualifiedName.split('.').pop() ?? entryPath.replace(/\.java$/, '').split('/').pop() ?? '';
    let position = new Position(0, 0);

    try {
        const content = readZipEntry(zipPath, entryPath);
        position = findTypeDeclarationPosition(content, typeName);
    } catch (error) {
        console.error('[javaSupport] Failed to read JDK source for navigation:', error);
    }

    const uri = createJdkSourceUri(zipPath, entryPath);
    return new Location(uri, new Range(position, position));
}

class JdkSourceFileSystemProvider implements FileSystemProvider {
    private readonly changeEmitter = new EventEmitter<{ type: FileChangeType; uri: Uri }[]>();
    readonly onDidChangeFile = this.changeEmitter.event;

    watch(): Disposable {
        return Disposable.from();
    }

    stat(uri: Uri): FileStat {
        const ref = parseJdkSourceUri(uri);
        if (!ref) {
            throw FileSystemError.FileNotFound(uri);
        }
        return {
            type: FileType.File,
            ctime: 0,
            mtime: 0,
            size: 0,
        };
    }

    readDirectory(): [string, FileType][] {
        throw FileSystemError.FileNotFound();
    }

    readFile(uri: Uri): Uint8Array {
        const ref = parseJdkSourceUri(uri);
        if (!ref) {
            throw FileSystemError.FileNotFound(uri);
        }
        return Buffer.from(readZipEntry(ref.zipPath, ref.entryPath), 'utf8');
    }

    createDirectory(): void {
        throw FileSystemError.NoPermissions();
    }

    writeFile(): void {
        throw FileSystemError.NoPermissions();
    }

    delete(): void {
        throw FileSystemError.NoPermissions();
    }

    rename(): void {
        throw FileSystemError.NoPermissions();
    }
}

export function registerJdkSourceContentProvider(context: ExtensionContext): void {
    const provider = new JdkSourceFileSystemProvider();
    context.subscriptions.push(
        workspace.registerFileSystemProvider(JDK_SRC_SCHEME, provider, {
            isReadonly: true,
            isCaseSensitive: true,
        }),
    );
}
