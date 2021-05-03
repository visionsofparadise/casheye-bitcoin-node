import AWS from "aws-sdk";

export const apiGatewaySockets = new AWS.ApiGatewayManagementApi({
	endpoint: process.env.WEBSOCKET_INTERFACE_URL!,
	apiVersion: '2018-11-29'
})