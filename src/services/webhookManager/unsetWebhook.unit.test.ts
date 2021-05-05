import { redis } from '../../redis'
import { rpc } from "../bitcoind/bitcoind"
import { unsetWebhook } from './unsetWebhook'

jest.mock('../bitcoind/bitcoind')
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

it('deletes an addressTxIn webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'addressTxIn'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'addressTxIn'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})

it('removes a new addressTxOut webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'addressTxOut'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'addressTxOut'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})

it('removes a new addressTx webhook', async () => {
	jest.clearAllMocks()
	expect.assertions(2)

	const JSONWebhook = JSON.stringify({
		address: 'test',
		id: 'test',
		event: 'addressTx'
	})

	rpc.setLabel.mockResolvedValue('test')		

	await redis.hset('test', 'test', JSONWebhook)

	await unsetWebhook({
		Body: JSON.stringify({
			id: 'test',
			address: 'test',
			event: 'addressTx'
		})
	})

	expect(await redis.hget('test', 'test')).toBeNull()

	expect(rpc.setLabel).toBeCalledTimes(1)
})
