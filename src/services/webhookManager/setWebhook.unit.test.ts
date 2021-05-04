import { rpc } from "../bitcoind/bitcoind"
import { setWebhook } from './setWebhook'
import { redis } from '../../redis'
import { decode } from "./webhookEncoder"

jest.mock('../bitcoind/bitcoind')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(() => redis.flushall())

it('adds a newBlock webhook', async () => {
	jest.clearAllMocks()	
	expect.assertions(2)

	rpc.importAddress.mockResolvedValue('test')	

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			event: 'newBlock'
		})
	})

	const data = await redis.hget('newBlock', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('newBlock')
	expect(rpc.importAddress).toBeCalledTimes(0)
})

it('adds a new addressTxIn webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	rpc.importAddress.mockResolvedValue('test')		

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'addressTxIn'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('addressTxIn')
	expect(rpc.importAddress).toBeCalledTimes(1)
})

it('adds a new addressTxOut webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	rpc.importAddress.mockResolvedValue('test')			

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'addressTxOut'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('addressTxOut')
	expect(rpc.importAddress).toBeCalledTimes(1)
})

it('adds a new addressTxAll webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)	

	rpc.importAddress.mockResolvedValue('test')		

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'addressTxAll'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('addressTxAll')
	expect(rpc.importAddress).toBeCalledTimes(1)
})
