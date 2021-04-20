import kuuid from 'kuuid'
import axios from "axios"
import { wait, logger } from '../../helpers'
import { testAddressGenerator } from '../../testAddressGenerator'
import { IWebhook } from '../../types/IWebhook'
import { encode } from 'querystring'

it('posts events for webhooks to test url endpoint', async () => {
	jest.useRealTimers()
	expect.assertions(6)

	const webhooks = [
		{
			id: kuuid.id(),
			userId: kuuid.id(),
			address: testAddressGenerator(),
			currency: 'BTC',
			confirmations: 6,
			event: 'anyTx',
			url: process.env.TEST_URL!
		},
		{
			id: kuuid.id(),
			userId: kuuid.id(),
			address: testAddressGenerator(),
			currency: 'BTC',
			confirmations: 6,
			event: 'newBlock',
			url: process.env.TEST_URL!
		},
	]

	const redisPut0 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: [webhooks[0].address, webhooks[0].id, encode(webhooks[0])]
	})

	logger.info(redisPut0.data)
	expect(redisPut0.status).toBe(200)

	const bitcoinPut = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'importAddress',
		args: [webhooks[0].address, 'set', false]
	})

	logger.info(bitcoinPut.data)
	expect(bitcoinPut.status).toBe(200)

	const redisPut1 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: ['newBlock', webhooks[1].id, encode(webhooks[1])]
	})

	logger.info(redisPut1.data)
	expect(redisPut1.status).toBe(200)

	await wait(10 * 1000)

	const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'sendToAddress',
		args: [webhooks[0].address, 1]
	})

	logger.info(bitcoinSend.data)
	expect(bitcoinSend.status).toBe(200)

	await wait(3 * 1000)

	for (let i = 0; i < 7; i++ ) {
		const generate1Response = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		logger.info(generate1Response.status)
	
		await wait(1000)
	}

	await wait(3 * 1000)

	const redisTestData = await axios.post(process.env.INSTANCE_URL! + 'redis', {
		command: 'hvals',
		args: ['testData']
	})

	logger.info(redisTestData.data)
	expect(redisTestData.status).toBe(200)
	expect(redisTestData.data.length).toBeGreaterThan(0)
}, 5 * 60 * 1000)
