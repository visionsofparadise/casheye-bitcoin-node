import AWS from "aws-sdk";

export const apiGatewaySockets = new AWS.ApiGatewayManagementApi({
	endpoint: process.env.WEBSOCKET_CONNECTION_URL!,
	region: 'us-east-1',
	apiVersion: '2018-11-29'
})