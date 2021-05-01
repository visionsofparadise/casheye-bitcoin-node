
import { rpc } from "../bitcoind/bitcoind"
import { confirmationsEvent } from "./confirmationsEvent"
import { redis } from '../../redis'
import { postEvents } from "./postEvents"
import day from 'dayjs'
import kuuid from "kuuid"

jest.mock('../bitcoind/bitcoind')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('posts event on address transaction confirmation', async () => {
	jest.clearAllMocks()
	jest.useRealTimers()

	const array: string[] = Array(20)
	
	await redis.lpush('blockHashCache', array.fill('test', 0, 20))

	const transactions = [{
		txid: 'test',
		address: 'test',
		category: 'send',
		label: 'set',
		blockhash: 'test',
		confirmations: 1,
		amount: 1
	}]
	
	rpc.listSinceBlock.mockResolvedValue({ transactions })

	for (const transaction of transactions) {
		await redis.hset('rawTxCache', transaction.txid, JSON.stringify(transaction))
		await redis.hset(transaction.address, 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))
	}

	await confirmationsEvent(kuuid.id(), day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts events on  valid address transaction confirmation and skips invalid', async () => {
	jest.clearAllMocks()
	jest.useRealTimers()

	const array: string[] = Array(20)
	
	await redis.lpush('blockHashCache', array.fill('test', 0, 20))

	const transactions = [{
		txid: 'test',
		address: 'test1',
		category: 'send',
		label: 'set',
		confirmations: 1,
		amount: 1
	},
	{
		txid: 'test',
		address: 'test2',
		category: 'send',
		label: 'set',
		confirmations: 0,
		amount: 1
	},
	{
		txid: 'test',
		address: 'test3',
		category: 'receive',
		label: 'set',
		confirmations: 5,
		amount: 1
	},
	{
		txid: 'test',
		address: 'test4',
		category: 'invalid',
		label: 'set',
		confirmations: 15,
		amount: 1
	},
	{
		txid: 'test',
		address: 'test5',
		category: 'send',
		label: 'set',
		confirmations: 15,
		amount: 1
	}]
	
	rpc.listSinceBlock.mockResolvedValue({ transactions })

	for (const tx of transactions) {
		await redis.hset('rawTxCache', tx.txid, JSON.stringify(tx))
	}

	await redis.hset(transactions[0].address, 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))
	await redis.hset(transactions[1].address, 'test', JSON.stringify({ event: 'inboundTx', confirmations: 6 }))
	await redis.hset(transactions[2].address, 'test', JSON.stringify({ event: 'inboundTx', confirmations: 6 }))
	await redis.hset(transactions[3].address, 'test', JSON.stringify({ event: 'anyTx', confirmations: 6 }))
	await redis.hset(transactions[4].address, 'test', JSON.stringify({ event: 'outboundTx', confirmations: 6 }))

	await confirmationsEvent(kuuid.id(), day().toISOString())

	expect(postEvents).toBeCalledTimes(1)
})