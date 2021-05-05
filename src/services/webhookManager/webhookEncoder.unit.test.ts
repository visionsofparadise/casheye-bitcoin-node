import omit from "lodash/omit"
import { IWebhook } from "../../types/IWebhook"
import { decode, encode } from "./webhookEncoder"

it('encodes then decodes webhook to get original back', () => {
	const webhook = {
		id: 'test',
		address: 'test',
		event: 'addressTx',
		currency: 'BTC'
	} as IWebhook

	const encodedWebhook = encode(webhook)

	expect(typeof encodedWebhook === 'string').toBe(true)

	const decodedWebhook = decode(encodedWebhook)

	expect(decodedWebhook).toStrictEqual(omit(webhook, ['currency']))
})