import { redis } from '../../../redis'
import { rpc } from "../../bitcoind/bitcoind"
import { unsetWebhook } from '../unsetWebhook'

jest.mock('../../bitcoind/bitcoind')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(() => redis.flushall())

it('removes a newBlock webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		id: 'test',
		event: 'newBlock'
	})

	rpc.setLabel.mockResolvedValue('test')	
	
	await redis.hset('newBlock', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSONWebhook
	})

	expect(await redis.hget('newBlock', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(0)
}, 5 * 1000)

it('deletes an inboundTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'inboundTx'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'inboundTx'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})

it('removes a new outboundTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'outboundTx'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'outboundTx'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})

it('removes a new anyTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'anyTx'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'anyTx'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})
