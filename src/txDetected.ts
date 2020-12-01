import { eventHelper, logger } from './helpers';
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

export const txDetected = async (txId: string) => {
	const tx = (await rpc.getTransaction(txId, true)) as GetTransactionResponse;

	logger.info({tx})

	const address = tx.details.filter(detail => detail.category === 'receive')[0]

	if (tx.confirmations !== 0 || !address || address.label !== 'watching') return;

	await rpc.setLabel(address.address, 'confirming');

	await eventHelper.send({
		DetailType: 'btcTxDetected',
		Detail: tx
	});

	return;
};
