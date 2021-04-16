import { logger, wait } from '../../helpers'
import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { setWebhook } from './setWebhook';
import { unsetWebhook } from './unsetWebhook';
import { redis } from '../../redis';
import { eventbridge } from '../../eventbridge'
import { sqs } from '../../sqs'

interface WebhookSetDetail {
	id: string;
	userId: string;
	node: number;
}

export const webhookSetEvent = new Event<WebhookSetDetail>({
	source: 'casheye-' + process.env.STAGE!,
	eventbridge,
	detailType: 'webhookSet',
	detailJSONSchema: jsonObjectSchemaGenerator<WebhookSetDetail>({
		description: 'Triggered when a webhook has been set in a node and is actively tracking events',
		properties: {
			id: { type: 'string' },
			userId: { type: 'string' },
			node: { type: 'number' }
		}
	})
});

type WebhookUnsetDetail = Omit<WebhookSetDetail, 'node'>

export const webhookUnsetEvent = new Event<WebhookUnsetDetail>({
	source: 'casheye-' + process.env.STAGE!,
	eventbridge,
	detailType: 'webhookUnset',
	detailJSONSchema: jsonObjectSchemaGenerator<WebhookUnsetDetail>({
		description: 'Triggered when a webhook has been set in a node and is actively tracking events',
		properties: {
			id: { type: 'string' },
			userId: { type: 'string' }
		}
	})
});

export const webhookManager = async (): Promise<any> => {
	logger.info('webhook manager started')

	let isOn = await redis.get('webhookManagerState') || '1'
	
	while (true) {
		if (isOn === '1') {
			logger.info(isOn)

			const SetQueueUrl = process.env.SET_QUEUE_URL! || 'set'

			const setQueueResponse = await sqs.receiveMessage({
				QueueUrl: SetQueueUrl,
				MaxNumberOfMessages: 10
			}).promise()

			logger.info(setQueueResponse)
		
			const UnsetQueueUrl = process.env.UNSET_QUEUE_URL! || 'unset'
		
			const unsetQueueResponse = await sqs.receiveMessage({
				QueueUrl: UnsetQueueUrl,
				MaxNumberOfMessages: 10
			}).promise()

			logger.info(unsetQueueResponse)
		
			const promises: Array<Promise<any>> = []
		
			if (setQueueResponse.Messages) {
				const messages = setQueueResponse.Messages.filter(msg => msg.Body)
		
				const results = await Promise.all(messages.map(async msg => setWebhook(msg)))
		
				const successes = results.filter(result => result !== undefined)
			
				const eventPromise = webhookSetEvent.send(successes.map(success => success!.eventEntry))
				promises.push(eventPromise)

				const sqsPromise = sqs.deleteMessageBatch({
					QueueUrl: SetQueueUrl,
					Entries: successes.map(success => (success!.queueEntry as any))
				}).promise()
	
				promises.push(sqsPromise)
			}
		
			if (unsetQueueResponse.Messages) {
				const messages = unsetQueueResponse.Messages.filter(msg => msg.Body)
		
				const results = await Promise.all(messages.map(async msg => unsetWebhook(msg)))
		
				const successes = results.filter(result => result !== undefined)
	
				const eventPromise = webhookUnsetEvent.send(successes.map(success => success!.eventEntry))
				promises.push(eventPromise)
		
				const sqsPromise = sqs.deleteMessageBatch({
					QueueUrl: UnsetQueueUrl,
					Entries: successes.map(success => (success!.queueEntry as any))
				}).promise()
	
				promises.push(sqsPromise)
		
				await Promise.all(promises)
			}
		}

		await wait(1000)

		isOn = await redis.get('webhookManagerState') || '1'
	}
}