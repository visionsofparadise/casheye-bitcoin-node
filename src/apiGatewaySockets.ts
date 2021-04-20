import AWS from "aws-sdk";

export const apiGatewaySockets = new AWS.ApiGatewayManagementApi({
	endpoint: process.env.WEBSOCKET_CONNECTION_URL!
})