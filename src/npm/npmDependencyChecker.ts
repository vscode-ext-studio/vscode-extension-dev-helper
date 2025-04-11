import { ExtensionContext, languages } from 'vscode';
import { activateOutdated } from './outdated/extension';
import { DependencyLinkProvider } from './provider/dependencyLinkProvider';
import { activateSearchNodeModules } from './provider/searchNodeModulesProvider';

export function activateNpmDependencyCheck(context: ExtensionContext) {
    activateOutdated(context);
    context.subscriptions.push(
        activateSearchNodeModules(context),
        languages.registerDefinitionProvider([
            { pattern: '**/package.json' },
            { pattern: '**/dependencies.jsonc' }
        ], new DependencyLinkProvider()),
    );
}

export function deactivate() { }