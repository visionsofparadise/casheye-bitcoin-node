import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { logger, eventbridge } from './helpers';
import { rpc } from './rpc'
import day from 'dayjs'

interface BtcAddressWatchingDetail {
	pubKey: string;
}

export const btcAddressWatchingEvent = new Event<BtcAddressWatchingDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcAddressWatching',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcAddressWatchingDetail>({
		description: 'Triggered when an address is being watched for transactions and confirmations.',
		properties: {
			pubKey: { type: 'string' }
		}
	})
});

type BtcAddressExpiredDetail = BtcAddressWatchingDetail

export const btcAddressExpiredEvent = new Event<BtcAddressExpiredDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcAddressExpired',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcAddressExpiredDetail>({
		description: 'Triggered when an address with no transactions expires and stops being watched.',
		properties: {
			pubKey: { type: 'string' }
		}
	})
});

interface GetAddressInfoResponse {
	label: string;
}

export const watchAddresses = async (batch: Array<{pubKey: string, expiresAt: number}>) => {
	const importAddressesResponse = await rpc.command(batch.map(item => ({
		method: 'importaddress',
		parameters: [item.pubKey, 'watching', false]
	})))

	logger.info('addresses imported ' + batch);
	logger.info({ importAddressesResponse });

	const timeouts: Array<NodeJS.Timeout> = []

	for (const item of batch) {
		const { pubKey, expiresAt } = item

		const timeout = setTimeout(() => {
			rpc.getAddressInfo(pubKey).then((getAddressData: GetAddressInfoResponse) => {
				logger.info({ getAddressData });
	
				if (getAddressData.label === 'watching') {
					logger.info('address expiring ' + pubKey);
	
					return rpc.setLabel(pubKey, 'expired').then(() => btcAddressExpiredEvent.send({
						pubKey
					})
					);
				}
	
				return;
			});
	
			return;
		}, expiresAt - day().unix())

		timeouts.push(timeout)
	}

	await btcAddressWatchingEvent.send(batch.map(item => ({
		pubKey: item.pubKey
	})))

	return timeouts
};
