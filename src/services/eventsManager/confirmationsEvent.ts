import { rpc, zeromqUrl } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';
import { Transaction } from 'bitcore-lib';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';
import zmq from 'zeromq'

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

export const confirmationsEvent = async (blockHash: string, requestStartTime: number) => {
	const processingStartTime = new Date().getTime()

	const lookback = 20
	const lastBlockHash = await redis.lindex('blockHashCache', lookback - 2)

	if (!lastBlockHash) return

	const txsSinceBlockPromise = rpc.listSinceBlock(lastBlockHash, undefined, true, false) as Promise<ListSinceBlockResponse>

	let rawTxCache = await redis.hgetall('rawTxCache')

	for (const key of Object.keys(rawTxCache)) rawTxCache[key] = JSON.parse(rawTxCache[key])

	const txsSinceBlock = await txsSinceBlockPromise

	const transactions = txsSinceBlock.transactions.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send') &&
		tx.amount > 0
	)

	const lowPriorityPromises: Promise<any>[] = []

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
			let isCached = true
			let rawTx: any = rawTxCache[tx.txid] as unknown as ListSinceBlockResponse['transactions']

			if (!rawTx) {
				isCached = false
				const getTx = await rpc.getTransaction(tx.txid, true) as { hex: string; txid: string }
				rawTx = {
					...new Transaction(getTx.hex),
					fee: tx.fee,
					txId: tx.txid
				}

				toCache.concat([rawTx.txId, JSON.stringify(rawTx)])
				lowPriorityPromises.push(cloudLog('recaching rawTx: ' + getTx.txid ))
			}

			const payload = {
				...rawTx,
				confirmations: tx.confirmations,
				casheye: {
					requestStartTime,
					processingStartTime,
					isCached
				}
			}

			const data: string[] = webhookData[index][1]
			const webhooks = data.map((webhook) => decode(webhook))

			webhooks.map(webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {	
					const pushEvent = () => events.push({ webhook, payload })

					if ((webhook.event === 'addressTxIn' || webhook.event === 'addressTxAll') && tx.category === 'receive') pushEvent()
					if ((webhook.event === 'addressTxOut' || webhook.event === 'addressTxAll') && tx.category === 'send') pushEvent()
				}
			})

			return
		} catch (error) {
			errors.push({ error })

			return
		}
	}))	

	await postEvents(events)

	const txIds = transactions.map(tx => tx.txid)
	const cacheTxIds = Object.keys(rawTxCache)
	const expiredRawTxIds = cacheTxIds.filter(id => !txIds.includes(id))

	const cachePromise = await redis.pipeline()
	.hdel('rawTxCache', ...expiredRawTxIds)
	.hset('rawTxCache', ...toCache)
	.lpush('blockHashCache', blockHash)
	.ltrim('blockHashCache', 0, lookback - 1)
	.exec()

	const logPromise = cloudLog({ transactions })
	const metricPromise = cloudMetric('txsSinceBlock', [txsSinceBlock.transactions.length])
	const errorLogPromise = cloudLog({ errors })

	await Promise.all<any>([...lowPriorityPromises, logPromise, metricPromise, errorLogPromise, cachePromise])
};

export const confirmationsSubscription = async () => {
	const sub = zmq.socket('sub')
	sub.connect(zeromqUrl)

	const subscription = 'hashblock'

	sub.on("message", async (channel, blockHash) => {
		const requestStartTime = new Date().getTime()

		if (channel.toString() === subscription) await confirmationsEvent(blockHash.toString(), requestStartTime).catch(cloudLog)
	})

	sub.subscribe(subscription);
}
