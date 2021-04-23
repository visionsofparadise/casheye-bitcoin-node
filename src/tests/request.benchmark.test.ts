import kuuid from 'kuuid'
import axios from "axios"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';
import day from 'dayjs';

describe('integration tests', () => {
	jest.useRealTimers()

	const N = process.env.N ? parseInt(process.env.N) : 1000
	const testId = kuuid.id()
	let client: WebSocket | undefined
	let wsMessages: any[] = []
	let wsErrors: any[] = []

	beforeAll((done) => {
		client = new WebSocket(process.env.WEBSOCKET_TEST_URL!);

		client!.on('open', () => {
			logger.info('is open');

			client!.send(
				JSON.stringify({
					action: 'message',
					data: {
						testId,
						instanceUrl: process.env.INSTANCE_URL!
					}
				})
			);

			logger.info('message sent');
			done()
		});

		client!.on("message", async (data: any) => {
			logger.info(data)

			if (data.requestStartTime) {
				wsMessages.push({
					...data,
					requestEndTime: day().valueOf()
				})
			} else {
				wsErrors.push(data)
			}
		})
	})

	afterAll(async () => {
		if (client && client.OPEN) {
				console.log('disconnecting...');
				client!.close();
		}

		await axios.post(process.env.INSTANCE_URL! + 'redis', {
			command: 'flushall',
			args: []
		})
	});

	it('tests webhooks with connectionId', async () => {
		expect.assertions(3)
		await wait(5 * 1000)
	
		try {
			const redisGetConnectionId = await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
				command: 'hget',
				args: ['testConnectionId', testId]
			})
		
			logger.info(redisGetConnectionId.data)
			expect(redisGetConnectionId.status).toBe(200)
	
			const anyTxWebhook = {
				id: kuuid.id(),
				userId: kuuid.id(),
				address: testAddressGenerator(),
				currency: 'BTC',
				confirmations: 1000,
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
		
			await wait(10 * 1000)
		
			for (let i = 0; i < N; i++ ) {
				const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
					command: 'sendToAddress',
					args: [anyTxWebhook.address, "0.0001"]
				})
			
				logger.info(bitcoinSend.data)
			
				await wait(1000)
			}

			await wait(3 * 1000)
		
			for (let i = 0; i < N; i++ ) {
				const generateResponse = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
					command: 'generate',
					args: [1]
				})
			
				logger.info(generateResponse.status)
			
				await wait(1000)
			}
		
			await wait(3 * 1000)
		
			logger.info(wsMessages)
			expect(wsMessages.length).toBe(3 * N)

			const parsedMessages = wsMessages.map(msg => JSON.parse(msg) as { confirmations?: number; height?: number; requestStartTime: number; requestEndTime: number })

			const addressTxEvents = parsedMessages.filter(msg => msg.confirmations && (msg.confirmations === 0))
			const confirmationEvents = parsedMessages.filter(msg => msg.confirmations && (msg.confirmations > 0))
			const newBlockEvents = parsedMessages.filter(msg => msg.height ? true : false)

			const responseTimes = (data: Array<{ requestStartTime: number; requestEndTime: number }>) => data
				.map(response => response.requestEndTime - response.requestStartTime)

			const average = (data: number[]) => Math.floor(data
				.reduce((prev, cur) => prev + cur) / data.length)

			const addressTxResponseTimes = responseTimes(addressTxEvents)

			logger.info('addressTx Response Times')
			logger.info(addressTxResponseTimes)
			logger.info('addressTx Average')
			logger.info(average(addressTxResponseTimes))

			const confirmationResponseTimes = responseTimes(confirmationEvents)

			logger.info('confirmation Response Times')
			logger.info(confirmationResponseTimes)
			logger.info('confirmation Average')
			logger.info(average(confirmationResponseTimes))

			const newBlockResponseTimes = responseTimes(newBlockEvents)

			logger.info('newBlock Response Times')
			logger.info(newBlockResponseTimes)
			logger.info('newBlock Average')
			logger.info(average(newBlockResponseTimes))

			expect(true).toBe(true)

		} catch (error) {
			logger.error(error)
	
			await wait(10 * 1000)
	
			const redisErrors = await axios.post(process.env.INSTANCE_URL! + 'redis', {
				command: 'hvals',
				args: ['errors']
			})
		
			logger.info(redisErrors.data)
	
			throw error
		}
	}, 30 * 60 * 1000)
})
