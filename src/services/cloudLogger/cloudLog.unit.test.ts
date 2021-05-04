import { redis } from "../../redis";
import { cloudLog } from "./cloudLog"

jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('logs string', async () => {
	await cloudLog('test')

	const logData = await redis.lrange('logs', 0, -1)
	const log = logData.map(log => JSON.parse(log))

	expect(log[0].message).toBe('test')
	expect(log[0].timestamp).toBeGreaterThan(0)
	expect(logData.length).toBe(1)
})

it('logs object', async () => {
	const message = { key: 'test' }
	await cloudLog(message)

	const logData = await redis.lrange('logs', 0, -1)
	const log = logData.map(log => JSON.parse(log))

	expect(log[0].message).toStrictEqual(JSON.stringify(message))
	expect(log[0].timestamp).toBeGreaterThan(0)
	expect(logData.length).toBe(1)
})