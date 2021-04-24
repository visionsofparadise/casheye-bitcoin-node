import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { logger } from '../../helpers';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';
import kuuid from 'kuuid';
import { GetTransactionResponse } from './addressTxEvent';

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
	const MAX_CONFIRMATIONS = process.env.MAX_CONFIRMATIONS ? parseInt(process.env.MAX_CONFIRMATIONS) : 20
	const blockCount = await rpc.getBlockCount() as number

	if (blockCount === 0) return

	const targetBlockNumber = blockCount > MAX_CONFIRMATIONS ? blockCount - MAX_CONFIRMATIONS : 0
	const result = await redis.pipeline()
		.hget('blockHashCache', targetBlockNumber.toString())
		.hset('blockHashCache', blockCount.toString(), blockHash)
		.exec()

	const cachedBlockHash = result[0][1]

	const lastBlockHash = cachedBlockHash || await rpc.getBlockHash(targetBlockNumber)

	if (!lastBlockHash) return

	const unfilteredTransactions: ListSinceBlockResponse = []
	
	try {
		const txs = await rpc.listSinceBlock(lastBlockHash, undefined, true, false) as ListSinceBlockResponse

		unfilteredTransactions.concat(txs)
	} catch (err) {
		return
	}

	const transactions = unfilteredTransactions.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send')
	)

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(transactions.map(async tx => {
		try {
			const rawTxPromise = rpc.getTransaction(tx.txid, true, true) as GetTransactionResponse

			const data = await redis.hvals(tx.address) as string[]

			const webhooks = data.map(webhook => decode(webhook))

			return webhooks.map(async webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {		
					const pushEvent = async () => events.push({ webhook, payload: (await Promise.resolve(rawTxPromise)).decoded })

					if ((webhook.event === 'inboundTx' || webhook.event === 'anyTx') && tx.category === 'receive') await pushEvent()
					if ((webhook.event === 'outboundTx' || webhook.event === 'anyTx') && tx.category === 'send') await pushEvent()
				}
			})
		} catch (error) {
			logger.error(error)

			if (process.env.STAGE !== 'prod') {
				await redis.hset('errors', kuuid.id(), JSON.stringify(error))
			}

			return
		}
	}))

	await postEvents(events, requestStartTime)
};
