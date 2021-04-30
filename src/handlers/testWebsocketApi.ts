import { HttpLambdaHandler } from 'xkore-lambda-helpers/dist/HttpLambdaHandler';
import { logger } from '../helpers';
import axios from 'axios';

export const testWebsocketHandler = new HttpLambdaHandler(
	{ method: 'POST' },
	async ({ event }) => {
		logger.info({ event })
		const { routeKey, connectionId } = event.requestContext;
		
		switch (routeKey!) {
			case '$connect':
				logger.info(connectionId + ' connected');
				break;
			case '$disconnect':
				logger.info(connectionId + ' disconnected');
				break;
			case 'message':
				logger.info(connectionId + ' hit message route');

				const { data } = JSON.parse(event.body!)

				logger.info({ data })

				const result = await axios.post<string>(data.instanceUrl + 'redis', {
					command: 'hset',
					args: ['testConnectionId', data.testId, connectionId]
				})

				logger.info({ result })
				
				break;
			case '$default':
				logger.info(connectionId + ' hit default route');
				
				break;
		}

		return
	}
);

export const handler = testWebsocketHandler.handler;
