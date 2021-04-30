import { rpc } from '../bitcoind/bitcoind'
import { postEvents } from './postEvents';
import { redis } from '../../redis';
import { decode } from '../webhookManager/webhookEncoder';
import { cloudLog } from '../cloudLogger/cloudLog';

export interface GetTransactionResponse {
	confirmations: number;
	hex: string;
	details: Array<{
		address: string;
		category: string;
		label: string;
		amount: number;
	}>;
	decoded: object
}

export const addressTxEvent = async (txId: string, requestStartTime: string) => {
	const tx = (await rpc.getTransaction(txId, true, true)) as GetTransactionResponse;

	if (!tx || tx.confirmations !== 0) return 

	const addresses = tx.details.filter(detail => 
		detail.label === 'set' && 
		detail.amount > 0 && 
		(detail.category === 'send' || detail.category === 'receive')
	)

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(addresses.map(async address => {
		try {
			const data = await redis.hvals(address.address) as string[]

			const webhooks = data.map(webhook => decode(webhook))
	
			return webhooks.map(async webhook => {
				const pushEvent = async () => events.push({ webhook, payload: tx.decoded })
	
				if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && address.category === 'receive') await pushEvent()
				if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && address.category === 'send') await pushEvent()
			})
		} catch (error) {
			await cloudLog(error)

			return
		}
	}))

	await postEvents(events, requestStartTime, 'addressTx')
};
