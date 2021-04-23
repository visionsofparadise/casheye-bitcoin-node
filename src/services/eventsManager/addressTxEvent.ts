import { rpc } from '../bitcoind/bitcoind'
import { postEvents } from './postEvents';
import { redis } from '../../redis';
import { decode } from '../webhookManager/webhookEncoder';

export interface GetTransactionResponse {
	confirmations: number;
	hex: string;
	details: Array<{
		address: string;
		category: string;
		label: string;
	}>;
}

export const addressTxEvent = async (txId: string, requestStartTime: string) => {
	let tx

	try {
		tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;
	} catch (err) {
		return
	}	

	if (!tx || tx.confirmations !== 0) return 

	const rawTxPromise = rpc.decodeRawTransaction(tx.hex)

	const addresses = tx.details.filter(detail => detail.label === 'set')

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(addresses.map(async address => {
		const data = await redis.hvals(address.address) as string[]

		const webhooks = data.map(webhook => decode(webhook))

		return webhooks.map(async webhook => {
			const rawTx = await Promise.resolve(rawTxPromise)

			if (!rawTx) return 

			const pushEvent = async () => events.push({ webhook, payload: rawTx })

			if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && address.category === 'receive') await pushEvent()
			if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && address.category === 'send') await pushEvent()
		})
	}))

	await postEvents(events, requestStartTime)
};
