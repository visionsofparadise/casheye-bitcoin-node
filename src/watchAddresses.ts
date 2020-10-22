import { btc } from './bitcoind';
import { sqs, logger, eventHelper } from './helpers';

interface AddressWatchMessage {
	address: string;
	duration: number;
}

interface GetAddressInfoResponse {
	label: string;
}

export const watchAddresses = async () => {
	const data = await sqs
		.receiveMessage({
			QueueUrl: process.env.WATCH_ADDRESS_QUEUE_URL!,
			MaxNumberOfMessages: 10,
			WaitTimeSeconds: 20,
			VisibilityTimeout: 5
		})
		.promise();

	logger.info({ data });

	if (!data.Messages) return;

	const messages = data.Messages.map(msg => JSON.parse(msg.Body!) as AddressWatchMessage);

	await Promise.all(
		messages.map(async msg => {
			const importAddressResponse = await btc.rpc.importAddress(msg.address, 'watching', false);

			await eventHelper.send({
				DetailType: 'btcAddressWatching',
				Detail: {
					address: msg.address
				}
			});

			logger.info('address imported ' + msg.address);
			logger.info({ importAddressResponse });

			setTimeout(() => {
				btc.rpc.getAddressInfo(msg.address).then((getAddressData: GetAddressInfoResponse) => {
					logger.info({ getAddressData });

					if (getAddressData.label === 'watching') {
						logger.info('address expiring ' + msg.address);

						return btc.rpc.setLabel(msg.address, 'expired').then(() => {
							return eventHelper.send({
								DetailType: 'btcAddressExpired',
								Detail: {
									address: msg.address
								}
							});
						});
					}

					return;
				});

				return;
			}, msg.duration);
		})
	);

	return;
};
