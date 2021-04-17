import { rpc } from "../../bitcoind/bitcoind"
import { setWebhook } from '../setWebhook'
import { redis } from '../../../redis'
import { decode } from "../webhookEncoder"

jest.mock('../../bitcoind/bitcoind')
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

it('adds a new inboundTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	rpc.importAddress.mockResolvedValue('test')		

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'inboundTx'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('inboundTx')
	expect(rpc.importAddress).toBeCalledTimes(1)
})

it('adds a new outboundTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	rpc.importAddress.mockResolvedValue('test')			

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'outboundTx'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('outboundTx')
	expect(rpc.importAddress).toBeCalledTimes(1)
})

it('adds a new anyTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)	

	rpc.importAddress.mockResolvedValue('test')		

	await setWebhook({
		Body: JSON.stringify({
			id: 'test',
			userId: 'test',
			address: 'test',
			event: 'anyTx'
		})
	})

	const data = await redis.hget('test', 'test') as string

	const webhook = decode(data)

	expect(webhook.event).toBe('anyTx')
	expect(rpc.importAddress).toBeCalledTimes(1)
})
