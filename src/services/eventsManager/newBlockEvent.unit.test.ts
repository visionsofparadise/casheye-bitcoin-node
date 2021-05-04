import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { newBlockEvent } from "./newBlockEvent"
import { redis } from '../../redis'

jest.mock('../bitcoind/bitcoind')
jest.mock('./postEvents')
jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

const item = JSON.stringify({})

const rawBlockHex = Buffer.from("00000020a15e218f5f158a31053ea101b917a6113c807f6bcdc85a000000000000000000cc7cf9eab23c2eae050377375666cd7862c1dfeb81abd3198c3a3f8e045d91484a39225af6d00018659e5e8a0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff64030096072cfabe6d6d08d1c2f6d904f4e1cd10c6558f8e5aed5d6a89c43bb22862464ebb819dd8813404000000f09f909f104d696e6564206279206a6f73656d7372000000000000000000000000000000000000000000000000000000000000000000007f06000001807c814a000000001976a914c825a1ecf2a6830c4401620c3a16f1995057c2ab88acefebcf38", 'hex')

it('posts event on new block and webhook', async () => {
	jest.clearAllMocks()
	
	rpc.getBlock.mockResolvedValue('test')

	await redis.hset('newBlock', 'test', item)

	await newBlockEvent(rawBlockHex, new Date().getTime())

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

	await newBlockEvent(rawBlockHex, new Date().getTime())

	expect(postEvents).toBeCalledTimes(1)
})