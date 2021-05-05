import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { newBlockEvent } from "./newBlockEvent"
import { redis } from '../../redis'

jest.mock('../bitcoind/bitcoind')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

const item = JSON.stringify({})

it('posts event on new block and webhook', async () => {
	jest.clearAllMocks()
	
	rpc.getBlock.mockResolvedValue('test')

	await redis.hset('newBlock', 'test', item)

	await newBlockEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})

it('posts multiple events', async () => {
	jest.clearAllMocks()
	
	rpc.getBlock.mockResolvedValue('test')

	await redis.hset('newBlock', 'test', item)
	await redis.hset('newBlock', 'test', item)
	await redis.hset('newBlock', 'test', item)
	await redis.hset('newBlock', 'test', item)
	await redis.hset('newBlock', 'test', item)

	await newBlockEvent('test', new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})