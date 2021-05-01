import axios from "axios";
import md5 from "md5";
import { sqs } from "../../sqs";
import { IWebhook } from "../../types/IWebhook";
import { apiGatewaySockets } from '../../apiGatewaySockets'
import { cloudLog } from "../cloudLogger/cloudLog";
// import { cloudMetric } from "../cloudLogger/cloudMetric";
// import day from "dayjs";

export const postEvents = async (events: Array<{ webhook: Omit<IWebhook, 'currency'>; payload: any }>, _: string) => {
	// await cloudLog({ events })
	const lowPriorityPromises: any[] = []
	const errors: any[] = []

	for (const event of events) {
		const { webhook, payload } = event

		try {
			if (webhook.url) {
				const response = await axios.post(webhook.url, payload)
	
				if (response.status > 299) throw new Error()
			}
	
			if (webhook.connectionId) {
				await apiGatewaySockets
					.postToConnection({
						ConnectionId: webhook.connectionId,
						Data: JSON.stringify(payload)
					})
					.promise();
			}

			// const metricPromise = cloudMetric('processingTime', [day().valueOf() - day(payload.requestStartTime).valueOf()], [{
			// 	name: 'processor',
			// 	value: callerName
			// }])

			// lowPriorityPromises.push(metricPromise)
		} catch (error) {
			lowPriorityPromises.push(cloudLog(error))
	
			const retry = {
				id: webhook.id,
				userId: webhook.userId,
				url: webhook.url,
				connectionId: webhook.connectionId,
				retries: 0,
				payload
			}
		
			const hash = md5(JSON.stringify(retry))

			errors.push({
				status: 'error',
				retry,
				hash
			})
		}
	}

	// await Promise.all(lowPriorityPromises)
	// await cloudMetric('events', [events.length - errors.length])

	if (errors.length > 0) {
		// await cloudMetric('errors', [errors.length])

		await sqs
		.sendMessageBatch({
			QueueUrl: process.env.ERROR_QUEUE_URL || 'test',
			Entries: errors.map(({ hash, retry }) => ({
				Id: hash!,
				MessageBody: JSON.stringify(retry!)
			}))
		})
		.promise();
	}
}