import kuuid from 'kuuid'
import axios from "axios"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';
import day from 'dayjs';

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
			const data  = JSON.parse(json)
			logger.info(data)

			if (data.requestStartTime) {
				const timeSplit = data.requestStartTime.split(',')
				logger.info({ timeSplit })
				const nanoSecondsSplit = timeSplit[1].split('+')
				logger.info({ nanoSecondsSplit })
				const milliseconds = Math.floor(parseInt(nanoSecondsSplit[0]) / 1000 * 1000)
				logger.info({ milliseconds })
				const iso8601Time = `${timeSplit[0]}.${milliseconds}+${nanoSecondsSplit[1]}`
				logger.info({ iso8601Time })

				const responseTime = day().valueOf() - day(iso8601Time).valueOf()

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

	it('benchmarks event response times', async () => {
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
	
		for (let i = 0; i < N; i++ ) {
			const anyTxWebhook = {
				id: kuuid.id(),
				userId: kuuid.id(),
				address: testAddressGenerator(),
				currency: 'BTC',
				confirmations: 1,
				event: 'anyTx',
				connectionId: redisGetConnectionId.data
			}
		
			await eventbridge.putEvents({
				Entries: [{
					Source: 'casheye-' + process.env.STAGE!,
					DetailType: 'setWebhook',
					Detail: JSON.stringify(anyTxWebhook)
				}]
			}).promise()
		
			await wait(3 * 1000)

			const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
				command: 'sendToAddress',
				args: [anyTxWebhook.address, "0.0001"]
			})
		
			logger.info(bitcoinSend.data)

			await wait(500)

			const generateResponse = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generateResponse.status)
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
	}, 30 * 60 * 1000)
})
