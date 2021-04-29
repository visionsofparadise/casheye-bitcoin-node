import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';
import { Transaction } from 'bitcore-lib';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

type ListSinceBlockResponse = Array<{
	txid: string;
	hex: string;
	address: string;
	category: string;
	confirmations: number
	label: string;
	blockhash: string;
}>;

export const confirmationsEvent = async (blockHash: string, requestStartTime: string) => {	
	const result = await redis.pipeline()
		.lpush('blockHashCache', blockHash)
		.lindex('blockHashCache', 20)
		.exec()

	const lastBlockHash = result[1][1]

	if (!lastBlockHash) return

	const txsSinceBlock = await rpc.listSinceBlock(lastBlockHash, undefined, true, false) as ListSinceBlockResponse

	const cloudMetricPromise = cloudMetric('txsSinceBlock', [txsSinceBlock.length])

	const transactions = txsSinceBlock.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send')
	)

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(transactions.map(async tx => {
		try {
			const rawTx = new Transaction(tx.hex)
			const payload = {
				confirmations: tx.confirmations,
				...rawTx
			}

			const data = await redis.hvals(tx.address) as string[]
			const webhooks = data.map(webhook => decode(webhook))

			return webhooks.map(async webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {		
					const pushEvent = async () => events.push({ webhook, payload })

					if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && tx.category === 'receive') await pushEvent()
					if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && tx.category === 'send') await pushEvent()
				}
			})
		} catch (error) {
			cloudLog(error)

			throw error
		}
	}))

	await postEvents(events, requestStartTime, 'confirmations')
	await Promise.resolve(cloudMetricPromise)
};
