import { redis } from "../../redis";
import { cloudPut } from "./cloudPut";
import { wait } from "../../helpers";
import { cloudwatchLogs, cloudwatch } from '../../cloudwatch'
import { metrics } from "../../cdk/stack";

jest.useRealTimers()

jest.mock('ioredis', () => require('ioredis-mock/jest'));

jest.mock('../../cloudwatch', () => ({
	cloudwatchLogs: {
		createLogStream: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		}),
		putLogEvents: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	},
	cloudwatch: {
		putMetricData: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	}
}))

beforeEach(async () => redis.flushall())

it('gets log data and sends to cloudwatch', async () => {
	expect.assertions(3)

	cloudPut()

	await wait(1000)

	const timestamp = new Date().getTime()

	const log = JSON.stringify({
		timestamp,
		message: 'test'
	})

	await redis.lpush('logs', log)
	await redis.lpush('logs', log)
	await redis.lpush('logs', log)
	await redis.lpush('logs', log)
	await redis.lpush('logs', log)

	const metric = JSON.stringify({
		timestamp,
		values: ['1'],
		dimensions: [{
			name: 'test',
			value: 'test'
		}]
	})

	await redis.lpush(`metric-${metrics[0]}`, metric)
	await redis.lpush(`metric-${metrics[0]}`, metric)
	await redis.lpush(`metric-${metrics[0]}`, metric)

	await wait(70 * 1000)

	expect(cloudwatchLogs.createLogStream).toBeCalledTimes(1)
	expect(cloudwatchLogs.putLogEvents).toBeCalledTimes(1)
	expect(cloudwatch.putMetricData).toBeCalledTimes(1)
}, 2 * 60 * 1000)