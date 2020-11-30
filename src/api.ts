import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { confirm } from './confirm';
import { txDetected } from './txDetected';
import { isProd } from './helpers';
import dotenv from 'dotenv'
dotenv.config()

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

	externalApi.get('/', async (_, res) => res.sendStatus(200));
	
	!isProd && externalApi.post('/rpc', async (req, res) => {	
		const { command, args } = req.body as { command: string; args?: Array<any> };

		const argsArray = args || [] 

		const result = await btc.rpc[command](...argsArray)

		return result ? res.status(200).send(result) : res.sendStatus(204)
	})

	return {
		externalApi,
		internalApi
	}
}


