import { EventLambdaHandler } from 'xkore-lambda-helpers/dist/EventLambdaHandler'
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { logger, sqs } from '../helpers'

export interface OnAddressCreatedDetail {
	pubKey: string
	expiresAt: number;
}

const detailJSONSchema = jsonObjectSchemaGenerator<OnAddressCreatedDetail>({
	description: 'Adds addressCreated events to the address watching queue',
	properties: {
		pubKey: { type: 'string' },
		expiresAt: { type: 'number' }
	}
})

export const onAddressCreatedHandler = new EventLambdaHandler<'addressCreated', OnAddressCreatedDetail>({
	detailType: ['addressCreated'],
	detailJSONSchema,
}, async ({ detail }) => {
		const response = await sqs
		.sendMessage({
			QueueUrl: process.env.QUEUE_URL || 'test',
			MessageGroupId: detail.pubKey,
			MessageDeduplicationId: detail.pubKey,
			MessageBody: JSON.stringify({
				pubKey: detail.pubKey,
				expiresAt: detail.expiresAt
			})
		})
		.promise();
	
		logger.info({ response });

		return
})

export const handler = onAddressCreatedHandler.handler