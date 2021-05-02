import kuuid from 'kuuid'
import axios from "axios"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';
import day from 'dayjs';
import { translateLinuxTime } from '../translateLinuxTime'

describe('benchmark tests', () => {
	jest.useRealTimers()

	const N = process.env.N ? parseInt(process.env.N) : 100
	const testId = kuuid.id()
	let client: WebSocket | undefined

	let addressTxResponseTimes: any[] = []
	let confirmationsResponseTimes: any[] = []
	let newBlockResponseTimes: any[] = []
	let wsErrors: any[] = []

	beforeAll(async (done) => {
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
			const requestEndTime = day().valueOf()
			const data  = JSON.parse(json)
			logger.info(data)

			if (data.requestStartTime) {
				const iso8601Time = translateLinuxTime(data.requestStartTime)
				logger.info({ iso8601Time })

				const responseTime = requestEndTime - iso8601Time

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
	});

	it('benchmarks event response times', async (done) => {
		expect.assertions(4)
		await wait(3 * 1000)
	
		const redisGetConnectionId = await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
			command: 'get',
			args: ['testConnectionId']
		})
	
		logger.info(redisGetConnectionId.data)
		expect(redisGetConnectionId.status).toBe(200)

		const newBlockWebhook = {
			id: kuuid.id(),
			userId: kuuid.id(),
			currency: 'BTC',
			event: 'newBlock',
			connectionId: redisGetConnectionId.data
		}

		await eventbridge.putEvents({
			Entries: [{
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'setWebhook',
				Detail: JSON.stringify(newBlockWebhook)
			}]
		}).promise()

		let i = 0

		const interval = setInterval(() => {
			if (i > N) {
				clearInterval(interval)
				return
			}

			const anyTxWebhook = {
				id: kuuid.id(),
				userId: kuuid.id(),
				address: testAddressGenerator(),
				currency: 'BTC',
				confirmations: 1,
				event: 'anyTx',
				connectionId: redisGetConnectionId.data
			}
		
			eventbridge.putEvents({
				Entries: [{
					Source: 'casheye-' + process.env.STAGE!,
					DetailType: 'setWebhook',
					Detail: JSON.stringify(anyTxWebhook)
				}]
			}).promise().then(() => {
				setTimeout(() => {
					axios.post(process.env.INSTANCE_URL! + 'rpc', {
						command: 'sendToAddress',
						args: [anyTxWebhook.address, "0.0001"]
					}).then((data) => logger.info(data.data))
				}, 3 * 1000)

				setTimeout(() => {
					axios.post(process.env.INSTANCE_URL! + 'rpc', {
						command: 'generate',
						args: [1]
					}).then((data) => {
						logger.info(data.status)
						i = i + 1
					})
				}, 5 * 1000)
			})
		}, 7 * 1000)

		setTimeout(() => {
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
			done()
		}, ((7 * N) + 10) * 1000)
	}, 30 * 60 * 1000)
})
