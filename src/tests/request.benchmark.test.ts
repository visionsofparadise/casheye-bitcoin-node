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

	let addressTxResponseTimes: any[] = []
	let confirmationsResponseTimes: any[] = []
	let newBlockResponseTimes: any[] = []
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

		client!.on("message", async (json: string) => {
			const data  = JSON.parse(json)
			logger.info(data)

			if (data.requestStartTime) {
				const responseTime = day().valueOf() - day(data.requestStartTime).valueOf()

				if (data.inputs && !data.confirmations) {
					addressTxResponseTimes.push(responseTime)
				} else if (data.inputs && data.confirmations) {
					confirmationsResponseTimes.push(responseTime)
				} else if (data.height) {
					newBlockResponseTimes.push(responseTime)
				}
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
		expect.assertions(2)
		await wait(3 * 1000)
	
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

			logger.info({ wsErrors })

			const average = (data: number[]) => Math.floor(data
				.reduce((prev, cur) => prev + cur, 0) / data.length)

			logger.info('addressTx Response Times')
			logger.info(addressTxResponseTimes)
			logger.info('addressTx Average')
			logger.info(average(addressTxResponseTimes))

			logger.info('confirmation Response Times')
			logger.info(confirmationsResponseTimes)
			logger.info('confirmation Average')
			logger.info(average(confirmationsResponseTimes))

			logger.info('newBlock Response Times')
			logger.info(newBlockResponseTimes)
			logger.info('newBlock Average')
			logger.info(average(newBlockResponseTimes))

			expect(addressTxResponseTimes.length).toBe(N)
			expect(confirmationsResponseTimes.length).toBe(N)
			expect(newBlockResponseTimes.length).toBe(N)

			const redisErrors = await axios.post(process.env.INSTANCE_URL! + 'redis', {
				command: 'hvals',
				args: ['errors']
			})
		
			logger.info(redisErrors.data)

		} catch (error) {
			logger.error(error)
	
			await wait(5 * 1000)

			logger.info({ wsErrors })
	
			const redisErrors = await axios.post(process.env.INSTANCE_URL! + 'redis', {
				command: 'hvals',
				args: ['errors']
			})
		
			logger.info(redisErrors.data)
	
			throw error
		}
	}, 30 * 60 * 1000)
})
