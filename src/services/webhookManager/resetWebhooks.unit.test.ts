import { redis } from "../../redis"
import fs from 'fs'
import { resolve } from 'path'
import { resetWebhooks } from './resetWebhooks'
import { logger } from "../../helpers"
import { rpc } from '../bitcoind/bitcoind'

jest.mock('../bitcoind/bitcoind')
jest.mock('ioredis', () => require('ioredis-mock/jest'));
jest.mock('../../sqs', () => ({
	sqs: {
		sendMessageBatch: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	}
}))

beforeEach(() => redis.flushall())

process.env.SET_QUEUE_URL = 'test'

const item = JSON.stringify({ id: 'test', address: 'test1' })

it('deletes webhooks from redis and adds them to queue and deletes the wallet file', async () => {
	expect.assertions(6)
	jest.useRealTimers()
	jest.clearAllMocks()

	await redis.set('webhookManagerState', 'on')

	rpc.getAddressesByLabel.mockResolvedValue({
		'test1': {
			purpose: 'send'
		},
		'test2': {
			purpose: 'receive'
		},
		'test3': {
			purpose: 'send'
		}
	})

	await redis.hset('test1', '1', item)
	await redis.hset('test1', '2', item)
	await redis.hset('test2', '1', item)
	await redis.hset('test2', '2', item)
	await redis.hset('test3', '1', item)
	await redis.hset('test3', '2', item)

	await redis.hset('newBlock', '1', item)
	await redis.hset('newBlock', '2', item)
	await redis.hset('newBlock', '3', item)

	rpc.unloadWallet.mockResolvedValue('success')

	fs.writeFileSync(resolve(__dirname, '../bitcoind/wallet.dat'), 'test')

	rpc.createWallet.mockResolvedValue('success')

	await resetWebhooks().catch(logger.error)

	expect(await redis.get('webhookManagerState')).toBe('0')

	expect(await redis.hvals('test1')).toStrictEqual([])
	expect(await redis.hvals('test2')).toStrictEqual([])
	expect(await redis.hvals('test3')).toStrictEqual([])
	expect(await redis.hvals('newBlock')).toStrictEqual([])

	expect(fs.existsSync(resolve(__dirname, '../bitcoind/wallet.dat'))).toBe(false)
}, 60 * 1000)