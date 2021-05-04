import omit from "lodash/omit";
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

	const metricData = await redis.lrange(`metric-${metrics[0]}`, 0, -1)
	const metric = metricData.map(metric => JSON.parse(metric))

	expect(omit(metric[0], ['timestamp'])).toStrictEqual(metricEntry)
	expect(metric[0].timestamp).toBeGreaterThan(0)
	expect(metricData.length).toBe(1)
})