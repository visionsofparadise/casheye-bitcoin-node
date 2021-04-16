import { EventLambdaHandler } from 'xkore-lambda-helpers/dist/EventLambdaHandler'
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { logger } from '../helpers'
import md5 from 'md5'
import { IWebhook } from '../types/IWebhook'
import { sqs } from '../sqs'

export type OnUnsetWebhookDetail = Omit<IWebhook, 'confirmations' | 'url' | 'connectionId'> & { node: number; }

export const detailJSONSchema = jsonObjectSchemaGenerator<OnUnsetWebhookDetail>({
	description: 'Adds webhook to the unset queue',
	properties: {
		id: { type: 'string' },
		userId: { type: 'string' },
		address: { type: 'string', nullable: true },
		currency: { type: 'string', nullable: true },
		event: { type: 'string' },
		node: { type: 'number' }
	}
})

export const onUnsetWebhookHandler = new EventLambdaHandler<'unsetWebhook', OnUnsetWebhookDetail>({
	detailType: ['unsetWebhook'],
	detailJSONSchema,
}, async ({ detail }) => {
		const unsetQueueUrls = process.env.UNSET_QUEUE_URLS!.split(',')
		const QueueUrl = unsetQueueUrls[detail.node]
		const JSONDetail = JSON.stringify(detail)

		const hash = md5(JSONDetail)

		const response = await sqs
			.sendMessage({
				QueueUrl,
				MessageGroupId: hash,
				MessageDeduplicationId: hash,
				MessageBody: JSONDetail
			})
			.promise();
	
		logger.info({ response });
})

export const handler = onUnsetWebhookHandler.handler