import { eventbridge, logger } from './helpers';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { Event } from 'xkore-lambda-helpers/dist/Event'
import { rpc } from './rpc'
import chunk from 'lodash/chunk'

type BtcConfirmationDetail = {
	txid: string;
	address: string;
	confirmations: number
}

export const btcConfirmationEvent = new Event<BtcConfirmationDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcConfirmation',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcConfirmationDetail>({
		description: 'Triggered when a transaction is confirmed.',
		properties: {
			txid: { type: 'string' },
			address: { type: 'string' },
			confirmations: { type: 'number' }
		}
	})
});

type ListTransactionsResponse = Array<BtcConfirmationDetail>;

export const confirm = async () => {
	const page = async (pageNumber: number): Promise<void> => {
		const txs = (await rpc.listTransactions('confirming', 100, pageNumber * 100, true)) as ListTransactionsResponse;

		if (txs.length === 0) return

		logger.info({ txs })

		const txsBatch = chunk(txs, 10)

		for (const batch of txsBatch) {			
			await btcConfirmationEvent.send(batch.map(({ txid, address, confirmations }) => ({ txid, address, confirmations })))
		}

		const over6Txs = txs.filter(tx => tx.confirmations >= 6)

		await rpc.command(over6Txs.map(tx => ({
			method: 'setlabel',
			parameters: [tx.address, 'used']
		})))

		if (txs.length === 100) setTimeout(() => page(pageNumber + 1), 1000)

		return;
	};

	await page(0);
};
