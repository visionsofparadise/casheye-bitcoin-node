import AWS from "aws-sdk";

export const apiGatewaySockets = new AWS.ApiGatewayManagementApi({
	endpoint: 'http://' + process.env.WEBSOCKET_URL!.slice(6)
})