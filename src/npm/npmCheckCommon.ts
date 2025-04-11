import { DocumentSelector } from 'vscode';

export const selector: DocumentSelector = [
    { language: 'json', pattern: '**/package.json', scheme: 'file' },
    { language: 'jsonc', pattern: '**/dependencies.jsonc', scheme: 'file' }
];
