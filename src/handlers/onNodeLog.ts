import { EventLambdaHandler } from 'xkore-lambda-helpers/dist/EventLambdaHandler'
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { NodeLogDetail } from '../services/cloudLogger/cloudPut'
import reverse from 'lodash/reverse'
import { cloudwatchLogs, cloudwatch } from '../cloudwatch'

export type OnNodeLogDetail = NodeLogDetail

export const detailJSONSchema = jsonObjectSchemaGenerator<OnNodeLogDetail>({
	description: 'Adds webhook to the set queue',
	properties: {
		network: { type: 'string', nullable: true },
		node: { type: 'number', nullable: true },
		metric: { type: 'string', nullable: true },
		logEntries: { type: 'array', items: { type: 'array', items: { type: 'string' }}, nullable: true },
	}
})

export const onNodeLogHandler = new EventLambdaHandler<'nodeLog', OnNodeLogDetail>({
	detailType: ['nodeLog'],
	detailJSONSchema,
}, async ({ detail }) => {
	const namespace = `casheye/node/${process.env.STAGE!}/${detail.network!}/${detail.node!}`
	const now = new Date().getTime()

	if (!detail.metric) {
		const logGroupNames = process.env.LOG_GROUP_NAMES!.split(',')
		const logGroupName = logGroupNames[detail.node]

		const logStreamName = namespace + `/${now}`

		await cloudwatchLogs.createLogStream({
			logGroupName,
			logStreamName
		}).promise()
		
		await cloudwatchLogs.putLogEvents({
			logGroupName,
			logStreamName,
			logEvents: reverse(detail.logEntries).map(([message, timestamp]) => ({
				message,
				timestamp: parseInt(timestamp)
			}))
		}).promise()
	}

	if (detail.metric) {
		await cloudwatch.putMetricData({
			Namespace: namespace,
			MetricData: reverse(detail.logEntries).map(([metricData, timestamp]) => {
				const { values, dimensions } = JSON.parse(metricData)

				return {
					MetricName: detail.metric!,
					Values: values,
					Timestamp: parseInt(timestamp) as any,
					Dimensions: dimensions.map((d: { name: string; value: string }) => ({
						Name: d.name,
						Value: d.value
					}))
				}
			})
		}).promise()
	}
})

export const handler = onNodeLogHandler.handler