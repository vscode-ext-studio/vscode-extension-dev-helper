import { commands, l10n, TextDocument, window } from 'vscode'
import { pluginName } from './plugin'

export const COMMAND_INSTALL = `extension.npm.installDependencies`
export const COMMAND_INSTALL_REQUEST = `${pluginName}.installRequest`

export const packageInstallRequest = async (
  document: TextDocument
): Promise<void> => {

  const action = l10n.t('Run')
  const result = await window.showInformationMessage(
    l10n.t(
      'Run install command to finish updating packages.'
    ),
    action
  )

  if (result === action) {
    await document.save()
    commands.executeCommand(COMMAND_INSTALL, document.uri)
  }
}