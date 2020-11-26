import AWS from 'aws-sdk';
import spawnLogger from 'envlog';
import { createEventHelper } from 'xkore-lambda-helpers/dist/util/eventHelper';
import { dbClient } from 'xkore-lambda-helpers/dist/util/dbClient';
import dotenv from 'dotenv'
dotenv.config()

export const isProd = process.env.STAGE === 'prod';
export const isTest = !process.env.JEST_WORKER_ID;

export const eventbridge = isTest
	? new AWS.EventBridge({ apiVersion: '2015-10-07' })
	: (({
			putEvents: (_: any) => ({
				promise: () => 'success'
			})
	  } as unknown) as AWS.EventBridge);

export const eventHelper = createEventHelper({ eventbridge: eventbridge as any, Source: `casheye-${process.env.STAGE!}` });

export const docDb = new AWS.DynamoDB.DocumentClient()

export const db = dbClient(docDb, process.env.DYNAMODB_TABLE!);

export const logger = spawnLogger({
	envKey: 'STAGE',
	offValue: 'prod'
});


