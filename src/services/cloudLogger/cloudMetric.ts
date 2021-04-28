import { redis } from "../../redis";
import day from 'dayjs'

export const metrics = [
	'processingTime',
	'blockTransactionsReturned',
	'ramUsage',
	'webhooksSet',
	'webhooksUnset',
	'events',
	'errors',
]

export type Metric = typeof metrics[number]

export const cloudMetric = async (metric: Metric, values: number[], dimensions?: Array<{ name: string; value: string; }>) => 
	redis.zadd(`metric-${metric}`, 'NX', day().valueOf(), JSON.stringify({
		values,
		dimensions
	}))