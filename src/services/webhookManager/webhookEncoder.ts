import omit from "lodash/omit"
import { IWebhook } from '../../types/IWebhook'

export const encode = (webhook: IWebhook) => JSON.stringify(omit(webhook, ['currency']))
export const decode = (data: string) => JSON.parse(data) as Omit<IWebhook, 'currency'>