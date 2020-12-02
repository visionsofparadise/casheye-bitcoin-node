import { logger, eventHelper, eventbridge, eventSource } from './helpers';
import { rpc } from './rpc'

interface GetAddressInfoResponse {
	label: string;
}

export const watchAddresses = async (batch: Array<{address: string, duration: number}>) => {
	const importAddressesResponse = await rpc.command(batch.map(item => ({
		method: 'importaddress',
		parameters: [item.address, 'watching', false]
	})))

	await eventbridge.putEvents({
		Entries: batch.map(item => ({
			Source: eventSource,
			DetailType: 'btcAddressWatching',
			Detail: JSON.stringify({
				address: item.address
			})
		}))
	}).promise()

	logger.info('addresses imported ' + batch);
	logger.info({ importAddressesResponse });

	return await Promise.all(batch.map(({ address, duration }) => {
		return setTimeout(() => {
			rpc.getAddressInfo(address).then((getAddressData: GetAddressInfoResponse) => {
				logger.info({ getAddressData });
	
				if (getAddressData.label === 'watching') {
					logger.info('address expiring ' + address);
	
					return rpc.setLabel(address, 'expired').then(() => 
						eventHelper.send({
							DetailType: 'btcAddressExpired',
							Detail: {
								address
							}
						})
					);
				}
	
				return;
			});
	
			return;
		}, duration);
	}))
};
