import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { confirm } from './confirm';
import { testRPCCommands } from './testRPCCommands';
import { txDetected } from './txDetected';
import { watchAddresses } from './watchAddresses';

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/wallet-notify/:txId', async (req, res) => {
	const { txId } = req.params;

	await txDetected(txId);

	res.sendStatus(200);
});

app.post('/block-notify/:blockHash', async (_, res) => {
	await confirm();

	res.sendStatus(200);
});

app.listen(3000, async () => {
	const poll = () =>
		setTimeout(() => {
			watchAddresses().then(() => {
				poll();
			});
		}, 100);

	poll();

	const testRPCPoll = () =>
		setTimeout(() => {
			testRPCCommands().then(() => {
				testRPCPoll();
			});
		}, 100);

	testRPCPoll();
});
