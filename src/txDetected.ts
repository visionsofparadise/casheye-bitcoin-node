import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { eventbridge, logger } from './helpers';
import { rpc } from './rpc'

interface GetTransactionResponse {
	confirmations: number;
	amount: number;
	details: Array<{
		address: string;
		category: string;
		label: string;
	}>;
}

interface BtcTxDetectedDetail extends GetTransactionResponse {}

export const btcTxDetectedEvent = new Event<BtcTxDetectedDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcTxDetected',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcTxDetectedDetail>({
		description: 'Triggered when an address is being watched for transactions and confirmations.',
		properties: {
			confirmations: { type: 'number' },
			amount: { type: 'number' },
			details: { type: 'array', items: jsonObjectSchemaGenerator<BtcTxDetectedDetail['details'][number]>({ 
				properties: {
					address: { type: 'string' },
					category: { type: 'string' },
					label: { type: 'string' }
				}
			})}
		}
	})
});

export const txDetected = async (txId: string) => {
	const tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;

	logger.info({tx})

	const address = tx.details.filter(detail => detail.category === 'receive')[0]

	if (tx.confirmations !== 0 || !address || address.label !== 'watching') return;

	await rpc.setLabel(address.address, 'confirming');

	await btcTxDetectedEvent.send(tx)

	return;
};
