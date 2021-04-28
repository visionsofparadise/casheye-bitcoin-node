import { chunk } from 'lodash'
import { cloudwatch, cloudwatchLogs } from '../../cloudwatch'
import { logger, wait } from '../../helpers'
import { redis } from '../../redis'
import { metrics } from './cloudMetric'

export const cloudPut = async (): Promise<any> => {
	logger.info('cloud logger started')
	
	while (true) {
		const logData = await redis.zrange('logs', 0, -1, 'WITHSCORES')
		const logEntries = chunk(logData, 2)

		if (logEntries.length > 0) {
			await cloudwatchLogs.putLogEvents({
				logGroupName: process.env.LOG_GROUP_NAME!,
				logStreamName: process.env.LOG_STREAM_NAME!,
				logEvents: logEntries.map(([message, timestamp]) => ({
					message,
					timestamp: parseInt(timestamp)
				}))
			}).promise()
		}

		for (const metric of metrics) {
			const metricData = await redis.zrange(`metric-${metric}`, 0, -1, 'WITHSCORES')
			const metricEntries = chunk(metricData, 2)

			if (metricEntries.length > 0) {
				await cloudwatch.putMetricData({
					Namespace: `casheye/node/${process.env.STAGE!}/${process.env.NETWORK!}/${process.env.NODE_INDEX!}`,
					MetricData: metricEntries.map(([metricData, timestamp]) => {
						const { values, dimensions } = JSON.parse(metricData)

						return {
							MetricName: metric,
							Values: values,
							Timestamp: parseInt(timestamp) as any,
							Dimensions: dimensions.map((d: { name: string; value: string }) => ({
								Name: d.name,
								Value: d.value
							}))
						}
					}),

				}).promise()
			}
		}

		await wait(60 * 1000)
	}
}