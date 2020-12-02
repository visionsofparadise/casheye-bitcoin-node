import upick from 'upick';
import { eventbridge, eventSource, logger } from './helpers';
import { rpc } from './rpc'

type ListTransactionsResponse = Array<{
	txid: string;
	address: string;
	confirmations: number;
}>;

export const confirm = async () => {
	const page = async (pageNumber: number) => {
		const txs = (await rpc.listTransactions('confirming', 100, pageNumber * 100, true)) as ListTransactionsResponse;

		logger.info({ txs })

		const over6Txs = txs.filter(tx => tx.confirmations > 6)
		const under6Txs = txs.filter(tx => tx.confirmations <= 6)

		await rpc.command(over6Txs.map(tx => ({
			method: 'setlabel',
			parameters: [tx.address, 'used']
		})))

		await eventbridge.putEvents({
			Entries: over6Txs.map(tx => ({
				Source: eventSource,
				DetailType: 'btcAddressUsed',
				Detail: JSON.stringify(upick(tx, ['txid', 'address', 'confirmations']))
			}))
		}).promise()

		await eventbridge.putEvents({
			Entries: under6Txs.map(tx => ({
				Source: eventSource,
				DetailType: 'btcConfirmation',
				Detail: JSON.stringify(upick(tx, ['txid', 'address', 'confirmations']))
			}))
		}).promise()

		return;
	};

	await page(0);
};
