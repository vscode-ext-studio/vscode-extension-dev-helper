import { ExtensionContext, languages } from 'vscode';
import { activateOutdated } from './outdated/extension';
import { DependencyLinkProvider } from './provider/dependencyLinkProvider';
import { activateSearchNodeModules } from './provider/searchNodeModulesProvider';
import { selector } from './npmCheckCommon';
export function activateNpmDependencyCheck(context: ExtensionContext) {
    activateOutdated(context);
    context.subscriptions.push(
        activateSearchNodeModules(context),
        languages.registerDefinitionProvider(selector, new DependencyLinkProvider()),
    );
}

export function deactivate() { }