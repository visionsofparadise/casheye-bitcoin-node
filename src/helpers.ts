import AWS from 'aws-sdk';
import spawnLogger from 'envlog';
import { createEventHelper } from 'xkore-lambda-helpers/dist/util/eventHelper';

export const isProd = process.env.STAGE === 'prod';
export const isUnitTest = process.env.UNIT_TEST === 'true';

export const eventbridge = isUnitTest
	? (({
		putEvents: (_: any) => ({
			promise: () => 'success'
		})
	} as unknown) as AWS.EventBridge)
	: new AWS.EventBridge({ 
			apiVersion: '2015-10-07',
			region: 'us-east-1',
			credentials: {
				accessKeyId: process.env.WATCHER_INSTANCE_USER!,
				secretAccessKey: process.env.WATCHER_INSTANCE_PASS!
			}
		})

export const eventHelper = createEventHelper({ eventbridge, Source: `casheye-${process.env.STAGE!}` });

export const logger = spawnLogger({
	envKey: 'STAGE',
	offValue: 'prod'
});


