import { logger } from '../../helpers'
import { SQS } from 'aws-sdk';
import { rpc } from '../bitcoind/bitcoind';
import { redis } from '../../redis'
import { OnUnsetWebhookDetail } from '../../handlers/onUnsetWebhook';

export const unsetWebhook = async (msg: SQS.Message): Promise<any> => {
	const webhook = JSON.parse(msg.Body!) as OnUnsetWebhookDetail
	const promises = []

	logger.info('Unsetting webhook: ' + webhook.id)		

	try {
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

		logger.info('Webhook unset: ' + webhook.id)

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
	} catch (error) {
		logger.error({ error })
		
		return
	}
}