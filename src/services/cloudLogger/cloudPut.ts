import { chunk } from 'lodash'
import { cloudwatch, cloudwatchLogs } from '../../cloudwatch'
import { logger, wait } from '../../helpers'
import { redis } from '../../redis'
import { metrics } from './cloudMetric'
import day from 'dayjs'

export const cloudPut = async (): Promise<any> => {
	logger.info('cloud logger started')

	const namespace = `casheye/node/${process.env.STAGE!}/${process.env.NETWORK!}/${process.env.NODE_INDEX!}`
	
	while (true) {
		const now = day().valueOf()
		const logDataResult = await redis.multi()
			.zrange('logs', 0, -1, 'WITHSCORES')
			.del('logs')
			.exec()
		const logData = logDataResult[0][1] as string[]
		
		if (logData.length > 0) {
			const logEntries = chunk(logData, 2)
			const logStreamName = namespace + `/${now}`

			await cloudwatchLogs.createLogStream({
				logGroupName: process.env.LOG_GROUP_NAME!,
				logStreamName
			}).promise()
			
			await cloudwatchLogs.putLogEvents({
				logGroupName: process.env.LOG_GROUP_NAME!,
				logStreamName,
				logEvents: logEntries.map(([message, timestamp]) => ({
					message,
					timestamp: parseInt(timestamp)
				}))
			}).promise()
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

				await cloudwatch.putMetricData({
					Namespace: namespace,
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