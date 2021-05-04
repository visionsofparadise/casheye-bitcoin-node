import bodyParser from 'body-parser'
import kuuid from 'kuuid'
import { logger, wait } from '../helpers'
import { redis } from '../redis'
import { testAddressGenerator } from '../testAddressGenerator'
import express from 'express';
import { rpc } from '../services/bitcoind/bitcoind'
import { encode } from '../services/webhookManager/webhookEncoder'
import { IWebhook } from '../types/IWebhook'

jest.useRealTimers()

process.env.TEST_XPUBKEY = 'tpubDCvoaaXJjhzzDUEHu5nGumgWQ55ieVEYctn21e77esGEWVr779J9ryPuzkFewCmF1jgt3bpS2JE7CJrTzes3gJvpWGn7SCTxWp5E7wfguoX'

const api = express();

api.use(bodyParser.json());

api.post('/', async (req, res) => {
	await redis.lpush('localTestEvents', JSON.stringify(req.body))

	res.sendStatus(204)
})

const testPort = 3001
const testUrl = `http://localhost:${testPort}/`

const addressTxAllWebhook = {
	id: kuuid.id(),
	userId: kuuid.id(),
	address: testAddressGenerator(),
	currency: 'BTC',
	confirmations: 6,
	event: 'addressTxAll',
	url: testUrl
}

const newBlockWebhook = {
	id: kuuid.id(),
	userId: kuuid.id(),
	currency: 'BTC',
	event: 'newBlock',
	url: testUrl
}

describe('sets up test url api and webhooks', async () => {
	let server: any | undefined

	beforeAll(async (done) => {
		server = api.listen(testPort, async () => {
			console.log(`Server listening on port ${testPort}`)

			await redis.hset(addressTxAllWebhook.address, addressTxAllWebhook.id, encode(addressTxAllWebhook as IWebhook))
			await redis.hset('newBlock', newBlockWebhook.id, encode(newBlockWebhook as IWebhook))
			await rpc.importAddress(addressTxAllWebhook.address, 'set', false)

			done()
		})
	})

	afterAll(async () => {
		if (server) server.close()

		await rpc.setLabel(addressTxAllWebhook.address, 'unset')
		await redis.hdel(addressTxAllWebhook.address, addressTxAllWebhook.id)
		await redis.hdel('newBlock', newBlockWebhook.id)
	})

	it('calls addressTx event', async () => {
		expect.assertions(1)

		await rpc.sendToAddress(addressTxAllWebhook.address, 0.001)

		await wait(5 * 1000)

		const length = await redis.llen('localTestEvents')

		logger.info({ length })
	
		expect(length).toBe(1)
	})
	
	it('calls confirmations and newBlock event', async () => {
		expect.assertions(1)

		await rpc.generate(1)

		await wait(5 * 1000)

		const length = await redis.llen('localTestEvents')
		const data = await redis.lrange('localTestEvents', 0, -1)

		logger.info({ length })
		logger.info({ data })
	
		expect(length).toBe(3)
	})
})