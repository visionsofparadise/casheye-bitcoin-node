export const metrics = [
	'processingTime',
	'blockTransactionsReturned',
	'ramUsage',
	'webhooksSet',
	'webhooksUnset',
	'events',
	'errors',
]

export type MetricType = typeof metrics[number]