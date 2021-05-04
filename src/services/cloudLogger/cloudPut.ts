import chunk from 'lodash/chunk'
import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { logger, wait } from '../../helpers'
import { redis } from '../../redis'
import { metrics } from './cloudMetric'
import { eventbridge } from '../../eventbridge'

export interface NodeLogDetail {
	network: string;
	node: number;
	metric?: string;
	logEntries: string[][];
}

export const nodeLogEvent = new Event<NodeLogDetail>({
	source: 'casheye-' + process.env.STAGE!,
	eventbridge,
	detailType: 'nodeLog',
	detailJSONSchema: jsonObjectSchemaGenerator<NodeLogDetail>({
		description: 'Triggered when a webhook has been set in a node and is actively tracking events',
		properties: {
			network: { type: 'string' },
			node: { type: 'number' },
			metric: { type: 'string', nullable: true },
			logEntries: { type: 'array', items: { type: 'array', items: { type: 'string' }} },
		}
	})
});

export const cloudPut = async (): Promise<any> => {
	logger.info('cloud logger started')

	const network = process.env.NETWORK!
	const node = parseInt(process.env.NODE_INDEX!)
	
	while (true) {
		const events: NodeLogDetail[] = []
		
		const logDataResult = await redis.multi()
			.zrange('logs', 0, -1, 'WITHSCORES')
			.del('logs')
			.exec()
		const logData = logDataResult[0][1] as string[]
		
		if (logData.length > 0) {
			const logEntries = chunk(logData, 2)

			events.push({
				node,
				network,
				logEntries
			})
		}

		for (const metric of metrics) {
			const meticKey = `metric-${metric}`
			const metricDataResult = await redis.multi()
				.zrange(meticKey, 0, -1, 'WITHSCORES')	
				.del(meticKey)
				.exec()
			const metricData = metricDataResult[0][1] as string[]

			if (metricData.length > 0) {
				const metricEntries = chunk(metricData, 2)

				events.push({
					node,
					network,
					metric,
					logEntries: metricEntries
				})
			}
		}

		await nodeLogEvent.send(events)

		await wait(60 * 1000)
	}
}