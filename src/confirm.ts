import { Currency, eventbridge, logger, Network, networkCurrencies } from './helpers';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator'
import { Event } from 'xkore-lambda-helpers/dist/Event'
import { rpc } from './rpc'
import chunk from 'lodash/chunk'

type NodeConfirmationDetail = {
	txid: string;
	address: string;
	confirmations: number
	currency: Currency
}

export const nodeConfirmationEvent = new Event<NodeConfirmationDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'nodeConfirmation',
	detailJSONSchema: jsonObjectSchemaGenerator<NodeConfirmationDetail>({
		description: 'Triggered when a transaction is confirmed.',
		properties: {
			txid: { type: 'string' },
			address: { type: 'string' },
			confirmations: { type: 'number' },
			currency: { type: 'string' }
		}
	})
});

type ListTransactionsResponse = Array<NodeConfirmationDetail>;

export const confirm = async () => {
	const page = async (pageNumber: number): Promise<void> => {
		const txs = (await rpc.listTransactions('confirming', 100, pageNumber * 100, true)) as ListTransactionsResponse;

		if (txs.length === 0) return

		logger.info({ txs })

		const txsBatch = chunk(txs, 10)

		for (const batch of txsBatch) {			
			await nodeConfirmationEvent.send(batch.map(({ txid, address, confirmations }) => ({ txid, address, confirmations, currency: networkCurrencies[process.env.NETWORK! as Network][0] as Currency })))
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
