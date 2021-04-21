import { HttpLambdaHandler } from 'xkore-lambda-helpers/dist/HttpLambdaHandler';
import { logger } from '../helpers';
import { Response, SUCCESS_NO_CONTENT_204 } from 'xkore-lambda-helpers/dist/Response';
import axios from 'axios';

export const testWebsocketHandler = new HttpLambdaHandler(
	{ method: 'POST' },
	async ({ event }) => {
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

				await axios.post<string>(data.instanceUrl + 'redis', {
					command: 'set',
					args: ['testConnectionId', connectionId]
				})
				
				break;
			case '$default':
					logger.info(connectionId + ' hit default route');
					
					break;
		}

		return new Response(SUCCESS_NO_CONTENT_204);
	}
);

export const handler = testWebsocketHandler.handler;
