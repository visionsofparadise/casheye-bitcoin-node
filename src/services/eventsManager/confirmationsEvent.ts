import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis, redisSub } from '../../redis';
import { Transaction } from 'bitcore-lib';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';
import { translateLinuxTime } from '../../translateLinuxTime';

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

					if ((webhook.event === 'addressTxIn' || webhook.event === 'addressTx') && tx.category === 'receive') pushEvent()
					if ((webhook.event === 'addressTxOut' || webhook.event === 'addressTx') && tx.category === 'send') pushEvent()
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

	const metricPromise = cloudMetric('blockTransactionsReturned', [txsSinceBlock.transactions.length])
	if (errors.length > 0) lowPriorityPromises.push(cloudLog({ errors }))

	await Promise.all<any>([...lowPriorityPromises, metricPromise, cachePromise])
};

export const confirmationsSubscription = async () => {
	await cloudLog('confirmationsSubscription listening...')

	const subscription = 'new-block'

	redisSub.on("message", async (channel, message) => {
		const [blockHash, timestamp] = message.split('#')

		if (channel === subscription) {
			const requestStartTime = translateLinuxTime(timestamp)
			
			await confirmationsEvent(blockHash, requestStartTime).catch(cloudLog)
		}
	})

	redisSub.subscribe(subscription);
}
