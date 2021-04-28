import { redis } from "../../redis";
import { cloudMetric, metrics } from "./cloudMetric"

jest.mock('ioredis', () => require('ioredis-mock/jest'));

beforeEach(async () => redis.flushall())

it('saves metric data', async () => {
	const metricEntry = {
		values: [1],
		dimensions: [{
			name: 'test',
			value: 'test'
		}]
	}

	await cloudMetric(metrics[0], metricEntry.values, metricEntry.dimensions)

	const metricData = await redis.zrange(`metric-${metrics[0]}`, 0, -1, 'WITHSCORES')

	expect(metricData[0]).toStrictEqual(JSON.stringify(metricEntry))
	expect(parseInt(metricData[1])).toBeGreaterThan(0)
	expect(metricData.length).toBe(2)
})