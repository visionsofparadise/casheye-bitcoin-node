import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import axios from 'axios';
import kuuid from 'kuuid';

export const handler = async (event: APIGatewayEvent) => {
	await axios.post<string>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: ['testData', kuuid.id(), event.body!]
	})

	return
}