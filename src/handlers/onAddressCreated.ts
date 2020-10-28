import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { logger } from '../helpers';
import axios from 'axios'
import day from 'dayjs'

export const handler = async (event: EventBridgeEvent<'addressCreated', { address: string; expiresAt: number }>) => {
	logger.info({ event });

	await axios.post(process.env.LOADBALANCER_URL! + 'address', {
		address: event.detail.address,
		duration: event.detail.expiresAt - day().unix()
	})

	return;
};
