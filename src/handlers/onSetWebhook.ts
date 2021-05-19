import { EventLambdaHandler } from 'xkore-lambda-helpers/dist/EventLambdaHandler'
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { logger } from '../helpers'
import { IWebhook } from '../types/IWebhook'
import { sqs } from '../sqs'

export type OnSetWebhookDetail = Omit<IWebhook, 'node'>

export const detailJSONSchema = jsonObjectSchemaGenerator<OnSetWebhookDetail>({
	description: 'Adds webhook to the set queue',
	properties: {
		id: { type: 'string' },
		userId: { type: 'string' },
		address: { type: 'string', nullable: true },
		currency: { type: 'string', nullable: true },
		confirmations: { type: 'number', nullable: true }, 
		event: { type: 'string' },
		url: { type: 'string', nullable: true },
		connectionId: { type: 'string', nullable: true }
	}
})

export const onSetWebhookHandler = new EventLambdaHandler<'setWebhook', OnSetWebhookDetail>({
	detailType: ['setWebhook'],
	detailJSONSchema,
}, async event => {
	console.log(event)
	const JSONDetail = JSON.stringify(event.detail)

	const response = await sqs
		.sendMessage({
			QueueUrl: process.env.SET_QUEUE_URL || 'test',
			MessageBody: JSONDetail
		})
		.promise();
	
	console.log(response)

	logger.info({ response });
})

export const handler = onSetWebhookHandler.handler