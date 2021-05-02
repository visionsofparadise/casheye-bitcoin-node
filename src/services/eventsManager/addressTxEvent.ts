import { rpc } from '../bitcoind/bitcoind'
import { postEvents } from './postEvents';
import { redis } from '../../redis';
import { decode } from '../webhookManager/webhookEncoder';
import { cloudLog } from '../cloudLogger/cloudLog';
import { Transaction } from 'bitcore-lib';

export interface GetTransactionResponse {
	confirmations: number;
	hex: string;
	fee: number;
	details: Array<{
		address: string;
		category: string;
		label: string;
		amount: number;
	}>;
	decoded: object
}

export const addressTxEvent = async (txId: string, requestStartTime: string) => {
	const tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;

	if (!tx || tx.confirmations > 1) return 

	const addresses = tx.details.filter(detail => 
		detail.label === 'set' && 
		detail.amount > 0 && 
		(detail.category === 'send' || detail.category === 'receive')
	)

	const rawTx = {
		...new Transaction(tx.hex),
		fee: Math.round(-tx.fee * (10 ** 8)),
		txId
	}

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(addresses.map(async address => {
		try {
			const data: string[] = await redis.hvals(address.address)

			const webhooks = data.map(webhook => decode(webhook))
	
			webhooks.map(async webhook => {
				const pushEvent = async () => events.push({ webhook, payload: { ...rawTx, requestStartTime } })
	
				if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && address.category === 'receive') await pushEvent()
				if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && address.category === 'send') await pushEvent()
			})

			return
		} catch (error) {
			await cloudLog({ error })

			return
		}
	}))

	await postEvents(events, 'addressTx')
	await redis.hset('rawTxCache', txId, JSON.stringify(rawTx))
};
