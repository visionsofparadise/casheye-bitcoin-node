import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { addressTxEvent } from "./addressTxEvent"
import { redis } from '../../redis'
import day from 'dayjs'

jest.mock('../bitcoind/bitcoind')
jest.mock('bitcore-lib')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('posts event on recieving address and inboundTx webhook', async () => {
	jest.clearAllMocks()
	
	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'receive',
			label: 'set'
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'inboundTx' }))

	await addressTxEvent('test', day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts event on send address and outboundTx webhook', async () => {
	jest.clearAllMocks()

	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'send',
			label: 'set'
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'outboundTx' }))

	await addressTxEvent('test', day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts both events for anyTx', async () => {
	jest.clearAllMocks()

	rpc.getTransaction.mockResolvedValue({
		confirmations: 0,
		hex: 'test',
		decoded: 'test',
		details: [{
			address: 'test',
			category: 'send',
			label: 'set'
		}, {
			address: 'test',
			category: 'receive',
			label: 'set'
		}]
	})

	await redis.hset('test', 'test', JSON.stringify({ event: 'anyTx' }))

	await addressTxEvent('test', day().toISOString())

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
			label: 'set'
		}, {
			address: 'test2',
			category: 'send',
			label: 'set'
		}, {
			address: 'test3',
			category: 'invalid',
			label: 'unset'
		}]
	})

	await redis.hset('test1', 'test', JSON.stringify({ event: 'inboundTx' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'outboundTx' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'invalid' }))
	await redis.hset('test1', 'test', JSON.stringify({ event: 'inboundTx' }))

	await redis.hset('test2', 'test', JSON.stringify({ event: 'outboundTx' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'outboundTx' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'invalid' }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'anyTx' }))

	await redis.hset('test3', 'test', JSON.stringify({ event: 'inboundTx' }))

	await addressTxEvent('test', day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})