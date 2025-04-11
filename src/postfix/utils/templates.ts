import * as vsc from 'vscode'
import { IPostfixTemplate } from '../template'
import { AwaitTemplate } from '../templates/awaitTemplate'
import { ForTemplate, ForOfTemplate, ForInTemplate } from '../templates/forTemplates'
import { VarTemplate } from '../templates/varTemplates'

export const loadBuiltinTemplates = () => {
  const config = vsc.workspace.getConfiguration('postfix')
  const disabledTemplates = config.get<string[]>('disabledBuiltinTemplates', [])

  const templates: IPostfixTemplate[] = [
    new VarTemplate('var'),
    new VarTemplate('let'),
    new VarTemplate('const'),
    new AwaitTemplate('await'),
    new ForOfTemplate('for'),
    new ForInTemplate('forin'),
    new ForTemplate('foreach'),
  ]

  return templates.filter(t => !disabledTemplates.includes(t.templateName))
}

export type CustomTemplateBodyType = string | string[]

interface ICustomTemplateDefinition {
  name: string
  description: string
  body: CustomTemplateBodyType,
  when: string[]
}
