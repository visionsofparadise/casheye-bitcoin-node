import AWS from "aws-sdk";

export const documentClient = new AWS.DynamoDB.DocumentClient({
			endpoint: 'localhost:8000',
			sslEnabled: false,
			region: 'local-env'
	  });