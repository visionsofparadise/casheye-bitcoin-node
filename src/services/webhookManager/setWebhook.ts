import { IWebhook } from '../../types/IWebhook';
import { SQS } from 'aws-sdk';
import { rpc } from '../bitcoind/bitcoind';
import { redis } from '../../redis'
import { encode } from './webhookEncoder'
import { cloudLog } from '../cloudLogger/cloudLog';

export const setWebhook = async (msg: SQS.Message): Promise<any> => {
	const webhook = JSON.parse(msg.Body!) as IWebhook

	if (webhook.event === 'newBlock') {
		await redis.hset('newBlock', webhook.id, encode(webhook))
	} else {
		await rpc.importAddress(webhook.address!, 'set', false)
		await redis
			.hset(webhook.address!, webhook.id, encode(webhook))
			.catch(() => rpc.setLabel(webhook.address!, 'unset'))
	}

	await cloudLog('webhook set ' + webhook.id)

	return {
		queueEntry: {
			Id: msg.MessageId,
			ReceiptHandle: msg.ReceiptHandle
		},
		eventEntry: {
			id: webhook.id,
			userId: webhook.userId,
			node: parseInt(process.env.NODE_INDEX!)
			}
	}
}