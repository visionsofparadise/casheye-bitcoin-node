import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { confirm } from './confirm';
import { txDetected } from './txDetected';
import { watchAddress } from './watchAddress';
import { isProd, logger } from './helpers';

export const getApis = (btc: any) => {
	const api = express();

	api.use(cors());
	api.use(bodyParser.urlencoded({ extended: true }));
	api.use(bodyParser.json());
	
	const internalApi = api
	const externalApi = api
	
	internalApi.get('/wallet-notify/:txId', async (req, res) => {
		const { txId } = req.params;
	
		await txDetected(txId, btc);
	
		return res.sendStatus(204);
	});
	
	internalApi.get('/block-notify/:blockHash', async (_, res) => {
		await confirm(btc);
	
		return res.sendStatus(204);
	});
	
	externalApi.post('/address', async (req, res) => {
		const { address, duration } = req.body;
	
		await watchAddress(address, duration, btc);
	
		return res.sendStatus(204);
	});
	
	externalApi.post('/rpc', async (req, res) => {
		if (isProd) res.sendStatus(401);
	
		logger.info(req.body)
	
		const { command } = req.body as { command: string };
	
		const result = await btc.rpc.command(command);

		return res.send(result);
})

externalApi.get('/', async (_, res) => res.sendStatus(200));

	return {
		externalApi,
		internalApi
	}
}


