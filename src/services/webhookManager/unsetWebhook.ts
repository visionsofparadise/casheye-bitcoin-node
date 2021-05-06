import { SQS } from 'aws-sdk';
import { rpc } from '../bitcoind/bitcoind';
import { redis } from '../../redis'
import { OnUnsetWebhookDetail } from '../../handlers/onUnsetWebhook';
import { cloudLog } from '../cloudLogger/cloudLog';

export const unsetWebhook = async (msg: SQS.Message): Promise<any> => {
	const webhook = JSON.parse(msg.Body!) as OnUnsetWebhookDetail

	if (webhook.event === 'newBlock') {
		await redis.hdel('newBlock', webhook.id)
	} else {
		await rpc.setLabel(webhook.address!, 'unset')
		await redis
			.hdel(webhook.address!, webhook.id)
			.catch(() => rpc.setLabel(webhook.address!, 'set'))
	}

	await cloudLog('webhook unset ' + webhook.id)

	return {
		queueEntry: {
			Id: msg.MessageId,
			ReceiptHandle: msg.ReceiptHandle
		},
			eventEntry: {
			id: webhook.id,
			userId: webhook.userId
			}
	}
}