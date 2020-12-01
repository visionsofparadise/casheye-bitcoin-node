import { logger, eventHelper } from './helpers';
import { rpc } from './rpc'

interface GetAddressInfoResponse {
	label: string;
}

export const watchAddress = async (address: string, duration: number) => {
	const importAddressResponse = await rpc.importAddress(address, 'watching', false);

	await eventHelper.send({
		DetailType: 'btcAddressWatching',
		Detail: {
			address
		}
	});

	logger.info('address imported ' + address);
	logger.info({ importAddressResponse });

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
};
