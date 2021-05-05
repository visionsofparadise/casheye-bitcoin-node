import { rpc } from '../bitcoind/bitcoind'
import { postEvents } from './postEvents';
import { redis, redisSub } from '../../redis';
import { decode } from '../webhookManager/webhookEncoder';
import { cloudLog } from '../cloudLogger/cloudLog';
import { Transaction } from 'bitcore-lib';
import { translateLinuxTime } from '../../translateLinuxTime';

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

export const addressTxEvent = async (txId: string, requestStartTime: number) => {
	const processingStartTime = new Date().getTime()
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
				const pushEvent = async () => events.push({ webhook, payload: { ...rawTx, casheye: { requestStartTime, processingStartTime } } })
	
				if ((webhook.event === 'addressTxIn' || webhook.event === 'addressTx') && address.category === 'receive') await pushEvent()
				if ((webhook.event === 'addressTxOut' || webhook.event === 'addressTx') && address.category === 'send') await pushEvent()
			})

			return
		} catch (error) {
			await cloudLog({ error })

			return
		}
	}))

	await postEvents(events)
	await redis.hset('rawTxCache', txId, JSON.stringify(rawTx))
};

export const addressTxSubscription = async () => {
	const subscription = 'new-tx'

	redisSub.on("message", async (channel, message) => {
		if (channel === subscription) {
			const [txId, timestamp] = message.split('#')

			const dedupKey = `dedup-${txId}`
			const data = await redis.multi()
				.get(dedupKey)
				.set(dedupKey, '1', 'EX', 30 * 60)
				.exec()
		
			const result = data[0][1]

			if (!result) {
				const requestStartTime = translateLinuxTime(timestamp)

				await addressTxEvent(txId, requestStartTime).catch(cloudLog)
			}
		}
	})

	redisSub.subscribe(subscription);
}
