import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../../helpers'
import { sqs } from '../../sqs'
import { testAddressGenerator } from '../../testAddressGenerator'
import { IWebhook } from '../../types/IWebhook'

describe('it sets and unsets a webhook', () => {
	jest.useRealTimers()

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		address: testAddressGenerator(),
		currency: 'BTC',
		confirmations: 6,
		event: 'anyTx',
		url: 'http://localhost/'
	}

	it('sets a webhook', async () => {
		expect.assertions(5)
	
		await sqs.sendMessage({
			QueueUrl: process.env.SET_QUEUE_URL!,
			MessageBody: JSON.stringify(webhook),
		}).promise()
	
		await wait(10 * 1000)
	
		const redisResponse = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [webhook.address, webhook.id]
		})
	
		logger.info(redisResponse.data)
		expect(redisResponse.status).toBe(200)
		expect(redisResponse.data).toStrictEqual(omit(webhook, ['currency']))
	
		const bitcoinResponse = await axios.post<{ iswatchonly: boolean; labels: string[] }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [webhook.address]
		})
	
		logger.info(bitcoinResponse.data)
		expect(bitcoinResponse.status).toBe(200)
		expect(bitcoinResponse.data.iswatchonly).toBe(true)
		expect(bitcoinResponse.data.labels[0]).toBe('set')
	}, 5 * 60 * 1000)

	it('unsets a webhook', async () => {
		expect.assertions(4)
	
		await sqs.sendMessage({
			QueueUrl: process.env.UNSET_QUEUE_URL_0!,
			MessageBody: JSON.stringify(webhook)
		}).promise()
	
		await wait(10 * 1000)
	
		const redisResponse = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [webhook.address, webhook.id]
		})
	
		logger.info(redisResponse.data)
		expect(redisResponse.status).toBe(200)
		expect(redisResponse.data).toBe(null)
	
		const bitcoinResponse = await axios.post<{ labels: string[] }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [webhook.address]
		})
	
		logger.info(bitcoinResponse.data)
		expect(bitcoinResponse.status).toBe(200)
		expect(bitcoinResponse.data.labels[0]).toBe('unset')
	}, 5 * 60 * 1000)
})
