import { eventHelper, logger } from './helpers';

interface GetTransactionResponse {
	confirmations: number;
	amount: number;
	details: Array<{
		address: string;
		category: string;
		label: string;
	}>;
}

export const txDetected = async (txId: string, btc: any) => {
	const tx = (await btc.rpc.getTransaction(txId, true)) as GetTransactionResponse;

	logger.info({tx})

	const address = tx.details.filter(detail => detail.category === 'receive')[0]

	if (tx.confirmations !== 0 || address.label !== 'watching') return;

	await btc.rpc.setLabel(address.address, 'confirming');

	await eventHelper.send({
		DetailType: 'btcTxDetected',
		Detail: tx
	});

	return;
};
