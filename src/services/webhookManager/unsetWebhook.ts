import { SQS } from 'aws-sdk';
import { rpc } from '../bitcoind/bitcoind';
import { redis } from '../../redis'
import { OnUnsetWebhookDetail } from '../../handlers/onUnsetWebhook';
import { cloudLog } from '../cloudLogger/cloudLog';

export const unsetWebhook = async (msg: SQS.Message): Promise<any> => {
	const webhook = JSON.parse(msg.Body!) as OnUnsetWebhookDetail
	const promises = []

	await cloudLog('unsetting webhook ' + webhook.id)		

	if (webhook.event === 'newBlock') {
		const dbPromise = redis.hdel('newBlock', webhook.id)
		promises.push(dbPromise)
	} else {
		const rpcPromise = rpc.setLabel(webhook.address!, 'unset')
		promises.push(rpcPromise)

		const dbPromise = redis.hdel(webhook.address!, webhook.id)
		promises.push(dbPromise)
	}

	await Promise.all(promises)

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