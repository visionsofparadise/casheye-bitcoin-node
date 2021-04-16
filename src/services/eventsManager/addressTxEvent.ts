import { rpc } from '../bitcoind/bitcoind'
import { postEvents } from './postEvents';
import { redis } from '../../redis';
import { decode } from '../webhookManager/webhookEncoder';
import { Transaction } from 'bitcore-lib'
import { logger } from '../../helpers';

export interface GetTransactionResponse {
	confirmations: number;
	hex: string;
	details: Array<{
		address: string;
		category: string;
		label: string;
	}>;
}

export const addressTxEvent = async (txId: string) => {
	const tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;

	if (tx.confirmations !== 0) return 

	const rawTx = new Transaction(tx.hex)

	const addresses = tx.details.filter(detail => detail.label === 'set')

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(addresses.map(async address => {
		const data = await redis.hvals(address.address) as string[]

		const webhooks = data.map(webhook => decode(webhook))

		return webhooks.map(async webhook => {
			if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && address.category === 'receive') {
				events.push({ webhook, payload: rawTx })
			}

			if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && address.category === 'send') {
				events.push({ webhook, payload: rawTx })
			}
		})
	}))

	await postEvents(events)
};

export const addressTxSubscriber = async () => {
	redis.on("message", (_: any, message: string) => {
		addressTxEvent(message).catch(logger.error)
	})

	redis.subscribe("newTx")

	logger.info('addressTx listening')

	return
}
