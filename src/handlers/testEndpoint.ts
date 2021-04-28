import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import kuuid from 'kuuid';
import { documentClient } from '../dynamodb'

export const handler = async (event: APIGatewayEvent) => {
	await documentClient.put({
		TableName: process.env.DYNAMODB_TABLE!,
		Item: {
			pk: 'BitcoinNodeTestData',
			sk: kuuid.id(),
			data: event.body!
		}
	}).promise()

	return
}