import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { logger } from '../helpers';
import axios from 'axios'

export const handler = async (event: EventBridgeEvent<'rpcCommand', { command: string; }>) => {
	logger.info({ event });

	const response = await axios.post(process.env.LOADBALANCER_URL! + 'rpc', {
		command: event.detail.command
	})

	logger.info({ response })

	return;
};
