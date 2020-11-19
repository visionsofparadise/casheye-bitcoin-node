import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { db, logger } from '../helpers';
import day from 'dayjs';

export const handler = async (event: EventBridgeEvent<'btcTxDetected' | 'btcAddressWatching' | 'btcAddressExpired' | 'btcAddressUsed' | 'btcConfirmation', any>) => {
	logger.info({ event });

	const response = await db.put({
		Item: {
			pk: 'TestEvent',
			sk: day().unix(),
			detailType: event["detail-type"],
			...event.detail
		}
	})

	logger.info({ response })

	return;
};
