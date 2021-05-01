import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';
import { Transaction } from 'bitcore-lib';
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
		fee: number;
	}>;
}

export const confirmationsEvent = async (blockHash: string, requestStartTime: string) => {	
	const result = await redis.pipeline()
		.lpush('blockHashCache', blockHash)
		.lindex('blockHashCache', 19)
		.ltrim('blockHashCache', 0, 19)
		.hvals('rawTxCache')
		.exec()

	const lastBlockHash: string = result[1][1]

	if (!lastBlockHash) return

	const txsSinceBlock = await rpc.listSinceBlock(lastBlockHash, undefined, true, false) as ListSinceBlockResponse

	const rawTxCache: any[] = result[3][1].map((data: string) => JSON.parse(data))

	await cloudMetric('txsSinceBlock', [txsSinceBlock.transactions.length])
	await cloudLog(txsSinceBlock)

	const transactions = txsSinceBlock.transactions.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send') &&
		tx.amount > 0
	)

	const webhookDataPipeline = redis.pipeline()

	for (const tx of transactions) {
		webhookDataPipeline.hvals(tx.address)
	}

	const webhookData = await webhookDataPipeline.exec()

	const events: Parameters<typeof postEvents>[0] = []
	const errors: any[] = []
	const toCache: string[] = []

	await Promise.all(transactions.map(async (tx, index) => {
		try {
			let rawTx = rawTxCache.filter(rawTx => rawTx.txId === tx.txid)[0]

			if (rawTx) await cloudLog('cached rawTx used')

			if (!rawTx) {
				const getTx = await rpc.getTransaction(tx.txid, true) as { hex: string }
				rawTx = {
					...new Transaction(getTx.hex),
					fee: tx.fee,
					txId: tx.txid
				}

				toCache.concat([rawTx.txId, JSON.stringify(rawTx)])
			}

			const payload = {
				requestStartTime,
				confirmations: tx.confirmations,
				...rawTx
			}

			const data: string[] = webhookData[index][1]
			const webhooks = data.map((webhook) => decode(webhook))

			webhooks.map(webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {	
					const pushEvent = () => events.push({ webhook, payload })

					if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && tx.category === 'receive') pushEvent()
					if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && tx.category === 'send') pushEvent()
				}
			})

			return
		} catch (error) {
			errors.push(error)

			return
		}
	}))

	await postEvents(events, 'confirmations')
	await cloudLog({ errors })

	const txIds = transactions.map(tx => tx.txid)
	const expiredRawTxs = rawTxCache.filter(tx => !txIds.includes(tx.txId))
	const expiredRawTxIds = expiredRawTxs.map(tx => tx.txid)

	await redis.pipeline()
		.hdel('rawTxCache', ...expiredRawTxIds)
		.hset('rawTxCache', ...toCache)
		.exec()
};
