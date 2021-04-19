import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../../helpers'
import { testAddressGenerator } from '../../testAddressGenerator'
import { IWebhook } from '../../types/IWebhook'
import { eventbridge } from '../../eventbridge'

it('it sets and unsets a webhook', async () => {
	jest.useRealTimers()
	expect.assertions(9)

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		address: testAddressGenerator(),
		currency: 'BTC',
		confirmations: 6,
		event: 'anyTx',
		url: 'http://localhost/'
	}

	await eventbridge.putEvents({
		Entries: [
			{
				DetailType: 'setWebhook',
				Detail: JSON.stringify(webhook)
			}
		]
	}).promise()

	await wait(10 * 1000)

	const redisResponse1 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hget',
		args: [webhook.address, webhook.id]
	})

	logger.info(redisResponse1.data)
	expect(redisResponse1.status).toBe(200)
	expect(redisResponse1.data).toStrictEqual(omit(webhook, ['currency']))

	const bitcoinResponse1 = await axios.post<{ iswatchonly: boolean; labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
		command: 'getAddressInfo',
		args: [webhook.address]
	})

	logger.info(bitcoinResponse1.data)
	expect(bitcoinResponse1.status).toBe(200)
	expect(bitcoinResponse1.data.iswatchonly).toBe(true)
	expect(bitcoinResponse1.data.labels[0].name).toBe('set')

	await eventbridge.putEvents({
		Entries: [
			{
				DetailType: 'unsetWebhook',
				Detail: JSON.stringify({
					...webhook,
					node: 0
				})
			}
		]
	}).promise()

	await wait(10 * 1000)

	const redisResponse2 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hget',
		args: [webhook.address, webhook.id]
	})

	logger.info(redisResponse2.data)
	expect(redisResponse2.status).toBe(200)
	expect(redisResponse2.data).toBe(null)

	const bitcoinResponse2 = await axios.post<{ labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
		command: 'getAddressInfo',
		args: [webhook.address]
	})

	logger.info(bitcoinResponse2.data)
	expect(bitcoinResponse2.status).toBe(200)
	expect(bitcoinResponse2.data.labels[0].name).toBe('unset')
}, 5 * 60 * 1000)
