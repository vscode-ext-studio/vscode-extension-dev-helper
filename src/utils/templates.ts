import * as vsc from 'vscode'
import { IPostfixTemplate } from '../template'
import { AwaitTemplate } from '../templates/awaitTemplate'
import { CustomTemplate } from '../templates/customTemplate'
import { ForTemplate, ForOfTemplate, ForInTemplate } from '../templates/forTemplates'
import { VarTemplate } from '../templates/varTemplates'

export const loadCustomTemplates = () => {
  const config = vsc.workspace.getConfiguration('postfix')
  const templates = config.get<ICustomTemplateDefinition[]>('customTemplates')
  if (templates) {
    return templates.map(t => new CustomTemplate(t.name, t.description, t.body, t.when))
  }

  return []
}

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
    // new ForEachTemplate('foreach'),
    // new CastTemplate('cast'),
    // new CastTemplate('castas'),
    // new CallTemplate('call'),
    // new ConsoleTemplate('log'),
    // new ConsoleTemplate('warn'),
    // new ConsoleTemplate('error'),
    // new IfTemplate('if'),
    // new ElseTemplate('else'),
    // new IfEqualityTemplate('null', '===', 'null'),
    // new IfEqualityTemplate('notnull', '!==', 'null'),
    // new IfEqualityTemplate('undefined', '===', 'undefined', true),
    // new IfEqualityTemplate('notundefined', '!==', 'undefined', true),
    // new EqualityTemplate('null', '===', 'null'),
    // new EqualityTemplate('notnull', '!==', 'null'),
    // new EqualityTemplate('undefined', '===', 'undefined', true),
    // new EqualityTemplate('notundefined', '!==', 'undefined', true),
    // new NewTemplate('new'),
    // new NotTemplate('not'),
    // new PromisifyTemplate('promisify'),
    // new ReturnTemplate('return'),

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
