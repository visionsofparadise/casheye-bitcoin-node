import axios from "axios";
import md5 from "md5";
import { logger } from "../../helpers";
import { sqs } from "../../sqs";
import { IWebhook } from "../../types/IWebhook";
import { apiGatewaySockets } from '../../apiGatewaySockets'
import kuuid from "kuuid";
import { redis } from "../../redis";

export const postEvents = async (webhooks: Array<{ webhook: Omit<IWebhook, 'currency'>; payload: any }>, requestStartTime: number) => {
	const results = await Promise.all(webhooks.map(async ({ webhook, payload }) => {
		try {
			if (webhook.url) {
				const response = await axios.post(webhook.url, { 
					...payload,
					requestStartTime
				})
	
				if (response.status > 299) throw new Error()
			}
	
			if (webhook.connectionId) {
				await apiGatewaySockets
					.postToConnection({
						ConnectionId: webhook.connectionId,
						Data: JSON.stringify({ 
							...payload,
							requestStartTime
						})
					})
					.promise();
			}

			return { status: 'success' }
		} catch (error) {
			logger.error({ error })

			if (process.env.STAGE !== 'prod') {
				await redis.hset('errors', kuuid.id(), JSON.stringify(error))
			}
	
			const retry = {
				id: webhook.id,
				userId: webhook.userId,
				url: webhook.url,
				connectionId: webhook.connectionId,
				retries: 0,
				payload
			}
		
			const hash = md5(JSON.stringify(retry))

			return {
				status: 'error',
				retry,
				hash
			}
		}
	}))

	const errors = results.filter(result => result.status === 'error')

	if (errors.length > 0) {
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