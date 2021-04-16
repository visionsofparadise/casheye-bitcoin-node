import { rpc } from '../bitcoind/bitcoind';
import { postEvents } from './postEvents';
import { logger } from '../../helpers';
import { decode } from '../webhookManager/webhookEncoder';
import { redis } from '../../redis';

type ListSinceBlockResponse = Array<{
	txid: string;
	address: string;
	category: string;
	confirmations: number
	label: string;
	blockhash: string;
}>;

export const confirmationsEvent = async () => {
	const blockCount = await rpc.getBlockCount() as number
	const lastBlockHash = await rpc.getBlockHash(blockCount - 20)
	const unfilteredTransactions = await rpc.listSinceBlock(lastBlockHash, undefined, true, false) as ListSinceBlockResponse

	const transactions = unfilteredTransactions.filter(tx => 
		tx.label === 'set' && 
		tx.confirmations > 0 && 
		(tx.category === 'receive' || tx.category === 'send')
	)

	const events: Parameters<typeof postEvents>[0] = []

	await Promise.all(transactions.map(async tx => {
		try {
			const rawTx = rpc.getRawTransaction(tx.txid, true, tx.blockhash)

			const data = await redis.hvals(tx.address) as string[]

			const webhooks = data.map(webhook => decode(webhook))

			return webhooks.map(async webhook => {
				if (webhook.confirmations && tx.confirmations <= webhook.confirmations) {		
					if (webhook.event === 'inboundTx' || webhook.event === 'anyTx' && tx.category === 'receive') {
						events.push({ webhook, payload: await Promise.resolve(rawTx) })
					}
		
					if (webhook.event === 'outboundTx' || webhook.event === 'anyTx' && tx.category === 'send') {
						events.push({ webhook, payload: await Promise.resolve(rawTx) })
					}
				}
			})
		} catch (error) {
			logger.error(error)

			return
		}
	}))

	await postEvents(events)
};

export const confirmationsSubscriber = async () => {
	redis.on("message", () => {
		confirmationsEvent().catch(logger.error)
	})

	redis.subscribe("newBlock")

	logger.info('confirmations listening')

	return
}
