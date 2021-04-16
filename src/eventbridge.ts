import AWS from "aws-sdk";

export const eventbridge = new AWS.EventBridge({ 
	apiVersion: '2015-10-07',
	region: 'us-east-1'
})