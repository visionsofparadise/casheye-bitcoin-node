import { btc } from './bitcoind';
import { eventHelper } from './helpers';

interface GetTransactionResponse {
	confirmations: number;
	details: Array<{
		address: string;
	}>;
}

export const txDetected = async (txId: string) => {
	const tx = (await btc.rpc.getTransaction(txId, true)) as GetTransactionResponse;

	if (tx.confirmations !== 0) return;

	await btc.rpc.setLabel(tx.details[0].address, 'confirming');

	await eventHelper.send({
		DetailType: 'btcTxDetected',
		Detail: tx
	});

	return;
};
