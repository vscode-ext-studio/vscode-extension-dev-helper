import { DocumentSelector, ExtensionContext, languages } from 'vscode'
import { VueClassStyleDefinitionProvider } from './vueClassStyleDefinitionProvider'

const vueSelector: DocumentSelector = [{ language: 'vue', scheme: 'file' }]

export function activateVueNavigation(context: ExtensionContext): void {
  context.subscriptions.push(
    languages.registerDefinitionProvider(
      vueSelector,
      new VueClassStyleDefinitionProvider(),
    ),
  )
}
