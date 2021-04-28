import { redis } from "../../redis";
import { cloudLog } from "./cloudLog"

jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('logs string', async () => {
	await cloudLog('test')

	const logData = await redis.zrange('logs', 0, -1, 'WITHSCORES')

	expect(logData[0]).toBe('test')
	expect(parseInt(logData[1])).toBeGreaterThan(0)
	expect(logData.length).toBe(2)
})

it('logs object', async () => {
	const message = { key: 'test' }
	await cloudLog(message)

	const logData = await redis.zrange('logs', 0, -1, 'WITHSCORES')

	expect(JSON.parse(logData[0])).toStrictEqual(message)
	expect(parseInt(logData[1])).toBeGreaterThan(0)
	expect(logData.length).toBe(2)
})