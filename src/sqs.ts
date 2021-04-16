import AWS from "aws-sdk";

export const sqs = new AWS.SQS({
	apiVersion: '2012-11-05',
	region: 'us-east-1'
});