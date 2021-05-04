import { redis } from "../../redis";

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
	redis.lpush(`metric-${metric}`, JSON.stringify({
		timestamp: new Date().getTime(),
		values,
		dimensions
	}))