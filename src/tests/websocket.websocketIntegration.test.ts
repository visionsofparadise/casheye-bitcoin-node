import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { IWebhook } from '../types/IWebhook'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';

describe('integration tests', () => {
	jest.useRealTimers()

	let client: WebSocket | undefined
	let wsMessages: any[] = []

	beforeAll(async (done) => {
		client = new WebSocket(process.env.WEBSOCKET_TEST_URL!);

		client!.on('open', () => {
			logger.info('is open');

			client!.send(
				JSON.stringify({
					action: 'message',
					data: {
						instanceUrl: process.env.INSTANCE_URL!
					}
				})
			);

			logger.info('message sent');
			done()
		});

		client!.on("message", async (data: any) => {
			logger.info(data)
			wsMessages.push(data)
		})
	})

	afterAll(async () => {
		if (client && client.OPEN) {
				console.log('disconnecting...');
				client!.close();
		}
	});

	it('tests webhooks with connectionId', async () => {
		expect.assertions(16)
		await wait(3 * 1000)
	
		const redisGetConnectionId = await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
			command: 'get',
			args: ['testConnectionId']
		})
	
		logger.info(redisGetConnectionId.data)
		expect(redisGetConnectionId.status).toBe(200)

		const anyTxWebhook = {
			id: kuuid.id(),
			userId: kuuid.id(),
			address: testAddressGenerator(),
			currency: 'BTC',
			confirmations: 6,
			event: 'anyTx',
			connectionId: redisGetConnectionId.data
		}
	
		const newBlockWebhook = {
			id: kuuid.id(),
			userId: kuuid.id(),
			currency: 'BTC',
			event: 'newBlock',
			connectionId: redisGetConnectionId.data
		}
	
		const webhooks = [anyTxWebhook, newBlockWebhook]
	
		await eventbridge.putEvents({
			Entries: webhooks.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'setWebhook',
				Detail: JSON.stringify(webhook)
			}))
		}).promise()
	
		await wait(5 * 1000)
	
		const redisGet = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook.address, anyTxWebhook.id]
		})
	
		logger.info(redisGet.data)
		expect(redisGet.status).toBe(200)
		expect(redisGet.data).toStrictEqual(omit(anyTxWebhook, ['currency']))
	
		const redisGet1 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet1.data)
		expect(redisGet1.status).toBe(200)
		expect(redisGet1.data).toStrictEqual(omit(newBlockWebhook, ['currency']))
	
		const bitcoinGet = await axios.post<{ iswatchonly: boolean; labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook.address]
		})
	
		logger.info(bitcoinGet.data)
		expect(bitcoinGet.status).toBe(200)
		expect(bitcoinGet.data.iswatchonly).toBe(true)
		expect(bitcoinGet.data.labels[0].name).toBe('set')
	
		const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'sendToAddress',
			args: [anyTxWebhook.address, "0.01"]
		})
	
		logger.info(bitcoinSend.data)
		expect(bitcoinSend.status).toBe(200)
	
		await wait(3 * 1000)
	
		for (let i = 0; i < 6; i++ ) {
			const generateResponse = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generateResponse.status)
		
			await wait(1000)
		}
	
		await wait(3 * 1000)
	
		logger.info(wsMessages)
		expect(wsMessages.length).toBe(13)
	
		await eventbridge.putEvents({
			Entries: webhooks.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'unsetWebhook',
				Detail: JSON.stringify({
					...webhook,
					node: 0
				})
			}))
		}).promise()
	
		await wait(5 * 1000)
	
		const redisGet2 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook.address, anyTxWebhook.id]
		})
	
		logger.info(redisGet2.data)
		expect(redisGet2.status).toBe(204)
		expect(redisGet2.data).toBe("")
	
		const redisGet3 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet3.data)
		expect(redisGet3.status).toBe(204)
		expect(redisGet3.data).toBe("")
	
		const bitcoinGet2 = await axios.post<{ labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook.address]
		})
	
		logger.info(bitcoinGet2.data)
		expect(bitcoinGet2.status).toBe(200)
		expect(bitcoinGet2.data.labels[0].name).toBe('unset')
	}, 10 * 60 * 1000)
})
