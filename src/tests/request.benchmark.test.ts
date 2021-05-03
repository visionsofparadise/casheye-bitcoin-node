import kuuid from 'kuuid'
import axios from "axios"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';
import day from 'dayjs';

interface Split {
	publishSplit: number;
	processingSplit: number;
	transitSplit: number;
	totalSplit: number;
}

describe('benchmark tests', () => {
	jest.useRealTimers()

	const N = process.env.N ? parseInt(process.env.N) : 100
	const testId = kuuid.id()
	let client: WebSocket | undefined

	let addressTxSplits: Split[] = []
	let confirmationsSplits: Split[] = []
	let newBlockSplits: Split[] = []
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
			const data: { 
				inputs?: any;
				outputs?: any
				confirmations?: any
				height?: any
				casheye: { 
					requestStartTime: number; 
					processingStartTime: number; 
					requestSendTime: number 
				}
			} = JSON.parse(json)

			const requestEndTime = day().valueOf()

			if (data.casheye.requestStartTime) {
				const publishSplit = data.casheye.processingStartTime - data.casheye.requestStartTime
				const processingSplit = data.casheye.requestSendTime - data.casheye.processingStartTime
				const transitSplit = requestEndTime - data.casheye.requestSendTime
				const totalSplit = requestEndTime - data.casheye.requestStartTime

				const split = { publishSplit, processingSplit, transitSplit, totalSplit }

				if (data.inputs && !data.confirmations) {
					addressTxSplits.push(split)
				} else if (data.inputs && data.confirmations) {
					confirmationsSplits.push(split)
				} else if (data.height) {
					newBlockSplits.push(split)
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
			if (i >= N) {
				setTimeout(() => clearInterval(interval), 7 * 1000)
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

			const average = (data: Split[]) => {
				const splitTotals = data.reduce((prev, cur) => ({
					publishSplit: prev.publishSplit + cur.publishSplit,
					processingSplit: prev.processingSplit + cur.processingSplit,
					transitSplit: prev.transitSplit + cur.transitSplit,
					totalSplit: prev.totalSplit + cur.totalSplit,
				}), { publishSplit: 0, processingSplit: 0, transitSplit: 0, totalSplit: 0 })

				return {
					publishSplitAvg: splitTotals.publishSplit / data.length,
					processingSplitAvg: splitTotals.processingSplit / data.length,
					transitSplitAvg: splitTotals.transitSplit / data.length,
					totalSplitAvg: splitTotals.totalSplit / data.length
				}
			}
	
			logger.info('addressTx Average')
			logger.info(average(addressTxSplits))
	
			logger.info('confirmation Average')
			logger.info(average(confirmationsSplits))
	
			logger.info('newBlock Average')
			logger.info(average(newBlockSplits))
	
			expect(addressTxSplits.length).toBe(N)
			expect(confirmationsSplits.length).toBe(N)
			expect(newBlockSplits.length).toBe(N)
			done()
		}, ((7 * N) + 60) * 1000)
	}, 30 * 60 * 1000)
})
