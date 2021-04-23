
import { rpc } from "../bitcoind/bitcoind"
import { confirmationsEvent } from "./confirmationsEvent"
import { redis } from '../../redis'
import { postEvents } from "./postEvents"
import day from 'dayjs'
import kuuid from "kuuid"

jest.mock('../bitcoind/bitcoind')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

rpc.getBlockCount.mockResolvedValue(100)
rpc.getBlockHash.mockResolvedValue('test')
rpc.getTransaction.mockResolvedValue({ hex: 'test', decode: 'test' })

beforeEach(async () => redis.flushall())

it('posts event on address transaction confirmation', async () => {
	jest.clearAllMocks()
	jest.useRealTimers()
	
	rpc.listSinceBlock.mockResolvedValue([{
		txid: 'test',
		address: 'test',
		category: 'send',
		label: 'set',
		blockhash: 'test',
		confirmations: 1
	}])

	

	await redis.hset('test', 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))

	await confirmationsEvent(kuuid.id(), day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts events on  valid address transaction confirmation and skips invalid', async () => {
	jest.clearAllMocks()
	jest.useRealTimers()
	
	rpc.listSinceBlock.mockResolvedValue([{
		txid: 'test',
		address: 'test1',
		category: 'send',
		label: 'set',
		confirmations: 1
	},
	{
		txid: 'test',
		address: 'test2',
		category: 'send',
		label: 'set',
		confirmations: 0
	},
	{
		txid: 'test',
		address: 'test3',
		category: 'receive',
		label: 'set',
		confirmations: 5
	},
	{
		txid: 'test',
		address: 'test4',
		category: 'invalid',
		label: 'set',
		confirmations: 15
	},
	{
		txid: 'test',
		address: 'test5',
		category: 'send',
		label: 'set',
		confirmations: 15
	}])

	rpc.getRawTransaction.mockResolvedValue('test')

	await redis.hset('test1', 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))
	await redis.hset('test2', 'test', JSON.stringify({ event: 'inboundTx', confirmations: 6 }))
	await redis.hset('test3', 'test', JSON.stringify({ event: 'inboundTx', confirmations: 6 }))
	await redis.hset('test4', 'test', JSON.stringify({ event: 'anyTx', confirmations: 6 }))
	await redis.hset('test5', 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))

	await confirmationsEvent(kuuid.id(), day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})