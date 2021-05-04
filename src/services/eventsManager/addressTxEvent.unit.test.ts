import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { addressTxEvent } from "./addressTxEvent"
import { redis } from '../../redis'

jest.mock('../bitcoind/bitcoind')
jest.mock('bitcore-lib')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('posts event on recieving address and addressTxIn webhook', async () => {
	jest.clearAllMocks()
	
	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'receive',
			label: 'set',
			amount: 1
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'addressTxIn' }))

	await addressTxEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts event on send address and addressTxOut webhook', async () => {
	jest.clearAllMocks()

	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'send',
			label: 'set',
			amount: 1
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'addressTxOut' }))

	await addressTxEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts both events for addressTxAll', async () => {
	jest.clearAllMocks()

	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'send',
			label: 'set',
			amount: 1
		}, {
			address: 'test',
			category: 'receive',
			label: 'set',
			amount: 1
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'addressTxAll' }))

	await addressTxEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts multiple events on valid addresses and webhooks and skips invalid ones', async () => {
	jest.clearAllMocks()

	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test1',
			category: 'receive',
			label: 'set',
			amount: 1
		}, {
			address: 'test2',
			category: 'send',
			label: 'set',
			amount: 1
		}, {
			address: 'test3',
			category: 'invalid',
			label: 'unset',
			amount: 1
		}]
	})

	await redis.hset('test1', 'test', JSON.stringify({ event: 'addressTxIn' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'addressTxOut' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'invalid' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'addressTxIn' }))

	await redis.hset('test2', 'test', JSON.stringify({ event: 'addressTxOut' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'addressTxOut' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'invalid' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'addressTxAll' }))

	await redis.hset('test3', 'test', JSON.stringify({ event: 'addressTxIn' }))

	await addressTxEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})