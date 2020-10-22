import AWS from 'aws-sdk';
import spawnLogger from 'envlog';
import { createEventHelper } from 'xkore-lambda-helpers/dist/util/eventHelper';

const isTest = !process.env.JEST_WORKER_ID;

export const eventbridge = isTest
	? new AWS.EventBridge({ apiVersion: '2015-10-07' })
	: (({
			putEvents: (_: any) => ({
				promise: () => 'success'
			})
	  } as unknown) as AWS.EventBridge);

export const eventHelper = createEventHelper({ eventbridge, Source: `casheye-${process.env.STAGE!}` });

export const sqs = new AWS.SQS();

export const logger = spawnLogger({
	envKey: 'XLH_LOGS',
	onValue: 'true'
});
