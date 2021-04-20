import kuuid from 'kuuid'
import axios from "axios"
import omit from "lodash/omit"
import { wait, logger } from '../helpers'
import { testAddressGenerator } from '../testAddressGenerator'
import { IWebhook } from '../types/IWebhook'
import { eventbridge } from '../eventbridge'

describe('tests url and connectionId endpoints', () => {
	it('it sets and unsets a webhook and posts events to a url', async () => {
		jest.useRealTimers()
		expect.assertions(16)

		try {
			const anyTxWebhook = {
				id: kuuid.id(),
				userId: kuuid.id(),
				address: testAddressGenerator(),
				currency: 'BTC',
				confirmations: 6,
				event: 'anyTx',
				url: 'http://localhost/'
			}
		
			const newBlockWebhook = {
				id: kuuid.id(),
				userId: kuuid.id(),
				currency: 'BTC',
				confirmations: 6,
				event: 'newBlock',
				url: 'http://localhost/'
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
				args: [anyTxWebhook.address, 1]
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
		} catch (error) {
			logger.error(error)

			throw error
		}
	}, 10 * 60 * 1000)
})

