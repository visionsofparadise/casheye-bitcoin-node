import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { IWebhook } from '../types/IWebhook'
import { eventbridge } from '../eventbridge'
import WebSocket from 'ws';

it('tests url and connectionId endpoints', async () => {
	jest.useRealTimers()
	expect.assertions(33)

	try {
		const anyTxWebhook = {
			id: kuuid.id(),
			userId: kuuid.id(),
			address: testAddressGenerator(),
			currency: 'BTC',
			confirmations: 6,
			event: 'anyTx',
			url: process.env.TEST_URL! + 'test'
		}
	
		const newBlockWebhook = {
			id: kuuid.id(),
			userId: kuuid.id(),
			currency: 'BTC',
			event: 'newBlock',
			url: process.env.TEST_URL! + 'test'
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
	
		const redisGet1 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook.address, anyTxWebhook.id]
		})
	
		logger.info(redisGet1.data)
		expect(redisGet1.status).toBe(200)
		expect(redisGet1.data).toStrictEqual(omit(anyTxWebhook, ['currency']))
	
		const redisGet2 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet2.data)
		expect(redisGet2.status).toBe(200)
		expect(redisGet2.data).toStrictEqual(omit(newBlockWebhook, ['currency']))
	
		const bitcoinGet1 = await axios.post<{ iswatchonly: boolean; labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook.address]
		})
	
		logger.info(bitcoinGet1.data)
		expect(bitcoinGet1.status).toBe(200)
		expect(bitcoinGet1.data.iswatchonly).toBe(true)
		expect(bitcoinGet1.data.labels[0].name).toBe('set')
	
		const bitcoinSend = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'sendToAddress',
			args: [anyTxWebhook.address, "0.01"]
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
			command: 'hkeys',
			args: ['testData']
		})
	
		logger.info(redisTestData.data)
		expect(redisTestData.status).toBe(200)
		expect(redisTestData.data.length).toBeGreaterThan(0)
	
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
	
		await wait(10 * 1000)
	
		const redisGet3 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook.address, anyTxWebhook.id]
		})
	
		logger.info(redisGet3.data)
		expect(redisGet3.status).toBe(204)
		expect(redisGet3.data).toBe("")
	
		const redisGet4 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook.id]
		})
	
		logger.info(redisGet4.data)
		expect(redisGet4.status).toBe(204)
		expect(redisGet4.data).toBe("")
	
		const bitcoinGet2 = await axios.post<{ labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook.address]
		})
	
		logger.info(bitcoinGet2.data)
		expect(bitcoinGet2.status).toBe(200)
		expect(bitcoinGet2.data.labels[0].name).toBe('unset')

		const client = new WebSocket(process.env.WEBSOCKET_TEST_URL!);

		await new Promise<void>(resolve => {
			client.on('open', () => {
				logger.info('is open');

				client.send(
					JSON.stringify({
						action: 'message',
						data: {
							instanceUrl: process.env.INSTANCE_URL!
						}
					})
				);

				logger.info('message sent');
				resolve()
			});
		})

		await wait(5 * 1000)

		const redisGetConnectionId = await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
			command: 'get',
			args: ['testConnectionId']
		})
	
		logger.info(redisGetConnectionId.data)
		expect(redisGetConnectionId.status).toBe(200)

		const anyTxWebhook2 = {
			id: kuuid.id(),
			userId: kuuid.id(),
			address: testAddressGenerator(),
			currency: 'BTC',
			confirmations: 6,
			event: 'anyTx',
			connectionId: redisGetConnectionId.data
		}
	
		const newBlockWebhook2 = {
			id: kuuid.id(),
			userId: kuuid.id(),
			currency: 'BTC',
			event: 'newBlock',
			connectionId: redisGetConnectionId.data
		}
	
		const webhooks2 = [anyTxWebhook2, newBlockWebhook2]
	
		await eventbridge.putEvents({
			Entries: webhooks2.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'setWebhook',
				Detail: JSON.stringify(webhook)
			}))
		}).promise()
	
		await wait(10 * 1000)
	
		const redisGet5 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook2.address, anyTxWebhook2.id]
		})
	
		logger.info(redisGet5.data)
		expect(redisGet5.status).toBe(200)
		expect(redisGet5.data).toStrictEqual(omit(anyTxWebhook2, ['currency']))
	
		const redisGet6 = await axios.post<IWebhook>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook2.id]
		})
	
		logger.info(redisGet6.data)
		expect(redisGet6.status).toBe(200)
		expect(redisGet6.data).toStrictEqual(omit(newBlockWebhook2, ['currency']))
	
		const bitcoinGet3 = await axios.post<{ iswatchonly: boolean; labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook2.address]
		})
	
		logger.info(bitcoinGet3.data)
		expect(bitcoinGet3.status).toBe(200)
		expect(bitcoinGet3.data.iswatchonly).toBe(true)
		expect(bitcoinGet3.data.labels[0].name).toBe('set')
	
		const bitcoinSend2 = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'sendToAddress',
			args: [anyTxWebhook2.address, "0.01"]
		})
	
		logger.info(bitcoinSend2.data)
		expect(bitcoinSend2.status).toBe(200)
	
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
	
		const redisTestData2 = await axios.post(process.env.INSTANCE_URL! + 'redis', {
			command: 'hvals',
			args: ['testData']
		})
	
		logger.info(redisTestData2.data)
		expect(redisTestData2.status).toBe(200)
		expect(redisTestData2.data.length).toBeGreaterThan(redisTestData.data.length)
	
		await eventbridge.putEvents({
			Entries: webhooks2.map(webhook => ({
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'unsetWebhook',
				Detail: JSON.stringify({
					...webhook,
					node: 0
				})
			}))
		}).promise()
	
		await wait(10 * 1000)
	
		const redisGet7 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: [anyTxWebhook2.address, anyTxWebhook2.id]
		})
	
		logger.info(redisGet7.data)
		expect(redisGet7.status).toBe(204)
		expect(redisGet7.data).toBe("")
	
		const redisGet8 = await axios.post<null>(process.env.INSTANCE_URL! + 'redis', {
			command: 'hget',
			args: ['newBlock', newBlockWebhook2.id]
		})
	
		logger.info(redisGet8.data)
		expect(redisGet8.status).toBe(204)
		expect(redisGet8.data).toBe("")
	
		const bitcoinGet4 = await axios.post<{ labels: Array<{ name: string; purpose: string; }> }>(process.env.INSTANCE_URL! + 'rpc', {
			command: 'getAddressInfo',
			args: [anyTxWebhook2.address]
		})
	
		logger.info(bitcoinGet4.data)
		expect(bitcoinGet4.status).toBe(200)
		expect(bitcoinGet4.data.labels[0].name).toBe('unset')
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
}, 10 * 60 * 1000)

