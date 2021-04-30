import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

type ListSinceBlockResponse = {
	transactions: Array<{
		txid: string;
		hex: string;
		address: string;
		amount: number
		category: string;
		confirmations: number
		label: string;
		blockhash: string;
	}>;
}

export const confirmationsEvent = async (blockHash: string, requestStartTime: string) => {	
	const result = await redis.pipeline()
		.lpush('blockHashCache', blockHash)
		.ltrim('blockHashCache', 0, 19)
		.lindex('blockHashCache', 19)
		.exec()

	const lastBlockHash = result[2][1]

	if (!lastBlockHash) return

	const txsSinceBlock = await rpc.listSinceBlock(lastBlockHash, undefined, true, false) as ListSinceBlockResponse

	const cloudMetricPromise = cloudMetric('txsSinceBlock', [txsSinceBlock.transactions.length])
	await cloudLog(txsSinceBlock)

	const transactions = txsSinceBlock.transactions.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send') &&
		tx.amount > 0
	)

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(transactions.map(async tx => {
		try {
			const getTx = await rpc.getTransaction(tx.txid, true, true) as { decoded: object }
			const data = await redis.hvals(tx.address) as string[]
			const webhooks = data.map(webhook => decode(webhook))

			return webhooks.map(async webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {		
					const pushEvent = async () => events.push({ webhook, payload: getTx.decoded })

					if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && tx.category === 'receive') await pushEvent()
					if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && tx.category === 'send') await pushEvent()
				}
			})
		} catch (error) {
			await cloudLog(error)

			return
		}
	}))

	await postEvents(events, requestStartTime, 'confirmations')
	await Promise.resolve(cloudMetricPromise)
};
