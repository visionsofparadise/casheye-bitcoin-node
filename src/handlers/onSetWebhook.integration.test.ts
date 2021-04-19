import { sqs } from "../sqs"
import kuuid from 'kuuid'
import { testAddressGenerator } from '../testAddressGenerator'
import { logger, wait } from "../helpers"
import axios from "axios"
import omit from "lodash/omit"

it('sets a webhook', async () => {
	jest.useRealTimers()
	expect.assertions(5)

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		address: testAddressGenerator(),
		currency: 'BTC',
		confirmations: 6,
		event: 'anyTx',
		url: 'http://localhost/'
	}

	const json = JSON.stringify(webhook)

	await sqs.sendMessage({
		QueueUrl: process.env.SET_QUEUE_URL!,
		MessageBody: json,
	}).promise()

	await wait(10 * 1000)

	const redisResponse = await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hget',
		args: [webhook.address, webhook.id]
	})

	logger.info(redisResponse.data)
	expect(redisResponse.status).toBe(200)
	
	const getWebhook = JSON.parse(redisResponse.data)

	logger.info(getWebhook.data)
	expect(getWebhook).toStrictEqual(omit(webhook, ['currency']))

	const bitcoinResponse = await axios.post<{ iswatchonly: boolean; labels: string[] }>(process.env.INSTANCE_URL! + 'rpc', {
		command: 'getAddressInfo',
		args: [webhook.address]
	})

	logger.info(bitcoinResponse.data)
	expect(bitcoinResponse.status).toBe(200)

	expect(bitcoinResponse.data.iswatchonly).toBe(true)
	expect(bitcoinResponse.data.labels[0]).toBe('set')
}, 5 * 60 * 1000)