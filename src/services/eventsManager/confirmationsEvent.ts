import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { decode } from '../webhookManager/webhookEncoder';
import { redis, redisSub } from '../../redis';
import { Transaction } from 'bitcore-lib';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';
import day from 'dayjs'
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
	const processingStartTime = day().valueOf()
	const result = await redis.pipeline()
		.lpush('blockHashCache', blockHash)
		.lindex('blockHashCache', 19)
		.ltrim('blockHashCache', 0, 19)
		.hvals('rawTxCache')
		.exec()

	const lastBlockHash: string = result[1][1]

	if (!lastBlockHash) return

	const txsSinceBlockPromise = rpc.listSinceBlock(lastBlockHash, undefined, true, false) as Promise<ListSinceBlockResponse>

	const rawTxCache: any[] = result[3][1].map((data: string) => JSON.parse(data))

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
			let rawTx = rawTxCache.filter(rawTx => rawTx.txId === tx.txid)[0]

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

					if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && tx.category === 'receive') pushEvent()
					if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && tx.category === 'send') pushEvent()
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
	const expiredRawTxs = rawTxCache.filter(tx => !txIds.includes(tx.txId))
	const expiredRawTxIds = expiredRawTxs.map(tx => tx.txid)

	const cachePromise = await redis.pipeline()
	.hdel('rawTxCache', ...expiredRawTxIds)
	.hset('rawTxCache', ...toCache)
	.exec()

	const logPromise = cloudLog({ transactions })
	const metricPromise = cloudMetric('txsSinceBlock', [txsSinceBlock.transactions.length])
	const errorLogPromise = cloudLog({ errors })

	await Promise.all<any>([...lowPriorityPromises, logPromise, metricPromise, errorLogPromise, cachePromise])
};

export const confirmationsSubscription = async () => {
	const subscription = 'new-block'

	redisSub.subscribe(subscription);

	redisSub.on("message", async (channel, message) => {
		if (channel === subscription) {
			const [blockHash, timestamp] = message.split('#')

			const requestStartTime = translateLinuxTime(timestamp)

			await confirmationsEvent(blockHash, requestStartTime).catch(cloudLog)
			await cloudLog(`new block: ${blockHash}`)
		}
	})
}
