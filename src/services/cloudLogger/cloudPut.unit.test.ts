import { redis } from "../../redis";
import { cloudPut } from "./cloudPut";
import day from 'dayjs'
import { wait } from "../../helpers";
import { cloudwatchLogs, cloudwatch } from '../../cloudwatch'
import { metrics } from "./cloudMetric";

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
	expect.assertions(2)

	cloudPut()

	await wait(1000)

	await redis.zadd('logs', 'NX', day().valueOf(), 'test')
	await redis.zadd('logs', 'NX', day().valueOf(), 'test')
	await redis.zadd('logs', 'NX', day().valueOf(), 'test')
	await redis.zadd('logs', 'NX', day().valueOf(), 'test')
	await redis.zadd('logs', 'NX', day().valueOf(), 'test')

	const metric = JSON.stringify({
		values: ['1'],
		dimensions: [{
			name: 'test',
			value: 'test'
		}]
	})

	await redis.zadd(`metric-${metrics[0]}`, 'NX', day().valueOf(), metric)
	await redis.zadd(`metric-${metrics[0]}`, 'NX', day().valueOf(), metric)
	await redis.zadd(`metric-${metrics[0]}`, 'NX', day().valueOf(), metric)

	await wait(70 * 1000)

	expect(cloudwatchLogs.putLogEvents).toBeCalledTimes(1)
	expect(cloudwatch.putMetricData).toBeCalledTimes(1)
}, 2 * 60 * 1000)