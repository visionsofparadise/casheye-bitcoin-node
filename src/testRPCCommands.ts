import { btc } from './bitcoind';
import { sqs, logger } from './helpers';

interface TestRPCCommandMessage {
	command: string;
}

export const testRPCCommands = async () => {
	if (process.env.STAGE === 'prod') return;

	const data = await sqs
		.receiveMessage({
			QueueUrl: process.env.WATCH_ADDRESS_QUEUE_URL!,
			MaxNumberOfMessages: 10,
			WaitTimeSeconds: 20,
			VisibilityTimeout: 5
		})
		.promise();

	logger.info({ data });

	if (!data.Messages) return;

	const messages = data.Messages.map(msg => JSON.parse(msg.Body!) as TestRPCCommandMessage);

	const responses = await Promise.all(messages.map(async msg => await btc.rpc.command(msg.command)));

	logger.info({ responses });

	return;
};
