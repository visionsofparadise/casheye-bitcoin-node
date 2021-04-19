import { sqs } from "../sqs"
import kuuid from 'kuuid'
import { testAddressGenerator } from '../testAddressGenerator'
import { wait } from "../helpers"
import axios from "axios"
import { encode } from "../services/webhookManager/webhookEncoder"

it('unsets a webhook', async () => {
	jest.useRealTimers()
	expect.assertions(6)

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		address: testAddressGenerator(),
		currency: 'BTC' as 'BTC',
		confirmations: 6,
		event: 'anyTx',
		url: 'http://localhost/',
		node: 0
	}

	const json = JSON.stringify(webhook)

	const redisPut = await axios.post(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: [webhook.address, webhook.id, encode(webhook)]
	})

	expect(redisPut.status).toBe(200)

	const bitcoinPut = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'importAddress',
		args: [webhook.address, 'set', false]
	})

	expect(bitcoinPut.status).toBe(200)

	await sqs.sendMessage({
		QueueUrl: process.env.UNSET_QUEUE_URL_0!,
		MessageBody: json
	}).promise()

	await wait(10 * 1000)

	const redisResponse = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hget',
		args: [webhook.address, webhook.id]
	})

	expect(redisResponse.status).toBe(200)
	expect(redisResponse.data).toBe(null)

	const bitcoinResponse = await axios.post<{ labels: string[] }>(process.env.INSTANCE_URL! + 'rpc', {
		command: 'getAddressInfo',
		args: [webhook.address]
	})

	expect(bitcoinResponse.status).toBe(200)
	expect(bitcoinResponse.data.labels[0]).toBe('unset')
}, 5 * 60 * 1000)