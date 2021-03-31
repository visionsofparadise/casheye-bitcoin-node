import { Event } from 'xkore-lambda-helpers/dist/Event';
import { jsonObjectSchemaGenerator } from 'xkore-lambda-helpers/dist/jsonObjectSchemaGenerator';
import { logger, eventbridge, networkCurrencies, Network, Currency } from './helpers';
import { rpc } from './rpc'
import day from 'dayjs'

interface NodeAddressWatchingDetail {
	pubKey: string;
	currency: Currency
}

export const nodeAddressWatchingEvent = new Event<NodeAddressWatchingDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'nodeAddressWatching',
	detailJSONSchema: jsonObjectSchemaGenerator<NodeAddressWatchingDetail>({
		description: 'Triggered when an address is being watched for transactions and confirmations.',
		properties: {
			pubKey: { type: 'string' },
			currency: { type: 'string' }
		}
	})
});

type NodeAddressExpiredDetail = NodeAddressWatchingDetail

export const nodeAddressExpiredEvent = new Event<NodeAddressExpiredDetail>({
	source: 'casheye-' + process.env.STAGE,
	eventbridge,
	detailType: 'nodeAddressExpired',
	detailJSONSchema: jsonObjectSchemaGenerator<NodeAddressExpiredDetail>({
		description: 'Triggered when an address with no transactions expires and stops being watched.',
		properties: {
			pubKey: { type: 'string' },
			currency: { type: 'string' }
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
	const currency = networkCurrencies[process.env.NETWORK! as Network][0] as Currency

	for (const item of batch) {
		const { pubKey, expiresAt } = item

		const timeout = setTimeout(() => {
			rpc.getAddressInfo(pubKey).then((getAddressData: GetAddressInfoResponse) => {
				logger.info({ getAddressData });
	
				if (getAddressData.label === 'watching') {
					logger.info('address expiring ' + pubKey);
	
					return rpc.setLabel(pubKey, 'expired').then(() => nodeAddressExpiredEvent.send({
						pubKey,
						currency
					})
					);
				}
	
				return;
			});
	
			return;
		}, (expiresAt - day().unix()) * 1000)

		timeouts.push(timeout)
	}

	await nodeAddressWatchingEvent.send(batch.map(item => ({
		pubKey: item.pubKey,
		currency
	})))

	return timeouts
};
