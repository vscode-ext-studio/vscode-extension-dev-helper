import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Location, workspace } from 'vscode';
import { createJdkSourceLocation } from './jdkSourceProtocol';

export class JdkSourceResolver {
    private static instance: JdkSourceResolver;

    private jdkHome?: string;
    private srcZipPath?: string;
    /** qualifiedName -> zip entry path */
    private sourceIndex = new Map<string, string>();
    private initPromise?: Promise<void>;
    private ready = false;

    public static getInstance(): JdkSourceResolver {
        if (!JdkSourceResolver.instance) {
            JdkSourceResolver.instance = new JdkSourceResolver();
        }
        return JdkSourceResolver.instance;
    }

    public initialize(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInitialize();
        }
        return this.initPromise;
    }

    public findJdkClass(qualifiedName: string): Location | undefined {
        if (!this.ready || !this.srcZipPath) {
            return undefined;
        }
        const entryPath = this.sourceIndex.get(qualifiedName);
        if (!entryPath) {
            return undefined;
        }
        return createJdkSourceLocation(this.srcZipPath, entryPath, qualifiedName);
    }

    public findJdkClassBySimpleName(simpleName: string): Location | undefined {
        return this.findJdkClass(`java.lang.${simpleName}`) ?? this.findJdkClass(simpleName);
    }

    private async doInitialize(): Promise<void> {
        this.jdkHome = this.findJdkHome();
        if (!this.jdkHome) {
            return;
        }

        this.srcZipPath = this.findSrcZip(this.jdkHome);
        if (!this.srcZipPath) {
            console.warn('[javaSupport] JDK src.zip not found under', this.jdkHome);
            return;
        }

        this.sourceIndex = this.buildSourceIndex(this.srcZipPath);
        this.ready = true;
        console.log(`[javaSupport] JDK source index ready: ${this.sourceIndex.size} classes (${this.srcZipPath})`);
    }

    private findJdkHome(): string | undefined {
        const configHome = workspace.getConfiguration('javaSupport').get<string>('jdkHome');
        if (configHome && existsSync(configHome)) {
            return configHome;
        }

        const jdtHome = workspace.getConfiguration('java').get<string>('jdt.ls.java.home');
        if (jdtHome && existsSync(jdtHome)) {
            return jdtHome;
        }

        const javaHome = workspace.getConfiguration('java').get<string>('home');
        if (javaHome && existsSync(javaHome)) {
            return javaHome;
        }

        if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) {
            return process.env.JAVA_HOME;
        }

        if (process.platform === 'darwin') {
            try {
                const home = execSync('/usr/libexec/java_home', { encoding: 'utf8' }).trim();
                if (home && existsSync(home)) {
                    return home;
                }
            } catch {
                // ignore
            }
        }

        try {
            const output = execSync('java -XshowSettings:properties -version 2>&1', { encoding: 'utf8' });
            const match = output.match(/^\s*java\.home\s*=\s*(.+)$/m);
            if (match?.[1] && existsSync(match[1].trim())) {
                return match[1].trim();
            }
        } catch {
            // ignore
        }

        return undefined;
    }

    private findSrcZip(jdkHome: string): string | undefined {
        const candidates = [
            join(jdkHome, 'lib', 'src.zip'),
            join(jdkHome, 'src.zip'),
        ];
        for (const candidate of candidates) {
            if (existsSync(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    private buildSourceIndex(srcZipPath: string): Map<string, string> {
        const index = new Map<string, string>();
        try {
            const output = execSync(`unzip -l "${srcZipPath}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
            const lines = output.split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*\d+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(.+\.java)\s*$/);
                if (!match) {
                    continue;
                }
                const entryPath = match[1];
                const sourcePath = entryPath.includes('/')
                    ? entryPath.substring(entryPath.indexOf('/') + 1)
                    : entryPath;
                const qualifiedName = sourcePath
                    .replace(/\.java$/, '')
                    .replace(/\//g, '.');
                if (!index.has(qualifiedName)) {
                    index.set(qualifiedName, entryPath);
                }
            }
        } catch (error) {
            console.error('[javaSupport] Failed to index JDK sources:', error);
        }
        return index;
    }
}
