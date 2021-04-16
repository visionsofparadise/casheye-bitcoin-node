import { logger } from '../../helpers'
import { IWebhook } from '../../types/IWebhook';
import { SQS } from 'aws-sdk';
import { rpc } from '../bitcoind/bitcoind';
import { redis } from '../../redis'
import { encode } from './webhookEncoder'

export const setWebhook = async (msg: SQS.Message): Promise<any> => {
	const webhook = JSON.parse(msg.Body!) as IWebhook
	const promises = []

	logger.info('Setting webhook: ' + webhook.id)	

	try {
		if (webhook.event === 'newBlock') {
			const dbPromise = redis.hset('newBlock', webhook.id, encode(webhook))
			
			promises.push(dbPromise)
		} else {
			const rpcPromise = rpc.importAddress(webhook.address, 'set', false)
			promises.push(rpcPromise)

			const dbPromise = redis.hset(webhook.address!, webhook.id, encode(webhook))
				
			promises.push(dbPromise)
		}

		await Promise.all(promises)

		logger.info('Webhook set: ' + webhook.id)

		return {
			queueEntry: {
				MessageId: msg.MessageId,
				ReceiptHandle: msg.ReceiptHandle
			},
			eventEntry: {
				id: webhook.id,
				userId: webhook.userId,
				node: parseInt(process.env.NODE_INDEX!)
				}
		}
	} catch (error) {
		logger.error({ error })
		
		return
	}
}