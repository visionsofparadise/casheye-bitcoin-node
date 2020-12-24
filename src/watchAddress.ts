import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { logger, eventbridge } from './helpers';
import { rpc } from './rpc'

interface BtcAddressWatchingDetail {
	address: string;
}

export const btcAddressWatchingEvent = new Event<BtcAddressWatchingDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcAddressWatching',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcAddressWatchingDetail>({
		description: 'Triggered when an address is being watched for transactions and confirmations.',
		properties: {
			address: { type: 'string' }
		}
	})
});

interface BtcAddressExpiredDetail {
	address: string;
}

export const btcAddressExpiredEvent = new Event<BtcAddressExpiredDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'btcAddressExpired',
	detailJSONSchema: jsonObjectSchemaGenerator<BtcAddressExpiredDetail>({
		description: 'Triggered when an address with no transactions expires and stops being watched.',
		properties: {
			address: { type: 'string' }
		}
	})
});

interface GetAddressInfoResponse {
	label: string;
}

export const watchAddresses = async (batch: Array<{address: string, duration: number}>) => {
	const importAddressesResponse = await rpc.command(batch.map(item => ({
		method: 'importaddress',
		parameters: [item.address, 'watching', false]
	})))

	await btcAddressWatchingEvent.send(batch.map(item => ({
			address: item.address
		})))

	logger.info('addresses imported ' + batch);
	logger.info({ importAddressesResponse });

	const timeouts: Array<NodeJS.Timeout> = []

	for (const item of batch) {
		const { address, duration } = item

		const timeout = setTimeout(() => {
			rpc.getAddressInfo(address).then((getAddressData: GetAddressInfoResponse) => {
				logger.info({ getAddressData });
	
				if (getAddressData.label === 'watching') {
					logger.info('address expiring ' + address);
	
					return rpc.setLabel(address, 'expired').then(() => btcAddressExpiredEvent.send({
						address
					})
					);
				}
	
				return;
			});
	
			return;
		}, duration)

		timeouts.push(timeout)

		return
	}

	return timeouts
};
