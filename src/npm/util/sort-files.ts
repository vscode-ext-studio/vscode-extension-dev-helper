import { statSync } from 'fs';

type File = {
    original: string;
    lower: string;
    isDirectory: boolean;
};

export const sortFiles = (folderFullPath: string, origFiles: string[]): string[] => {
    const files: File[] = origFiles.map(file => {
        const fullPath = `${folderFullPath}/${file}`;
        return {
            original: file,
            lower: file.toLowerCase(),
            isDirectory: statSync(fullPath).isDirectory()
        };
    });

    return files
        .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.lower.localeCompare(b.lower);
        })
        .map(file => file.original);
};