import AWS from "aws-sdk";

export const apiGatewaySockets = new AWS.ApiGatewayManagementApi({
	endpoint: `https://${process.env.WEBSOCKET_URL!.slice(6)}/test/@connections`,
	region: 'us-east-1',
	apiVersion: '2018-11-29'
})