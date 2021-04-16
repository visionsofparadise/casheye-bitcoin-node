import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { eventbridge } from '../../eventbridge'

export interface WebhookSetDetail {
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

export type WebhookUnsetDetail = Omit<WebhookSetDetail, 'node'>

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