import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isProd } from '../../helpers';
import { rpc } from '../bitcoind/bitcoind'
import { resetWebhooks } from '../webhookManager/resetWebhooks';
import { redis } from '../../redis';

const api = express();

api.use(cors());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(bodyParser.json());

api.get('/', async (_, res) => res.sendStatus(200));

!isProd && api.post('/rpc', async (req, res) => {	
	try {
		const { command, args } = req.body as { command: string; args?: Array<any> };

		const argsArray = args || [] 
	
		const result = await rpc[command](...argsArray)
		
		result ? res.status(200).send(result) : res.sendStatus(204)
	} catch (err) {
		res.status(500).send(err)
	}
})

!isProd && api.post('/redis', async (req, res) => {	
	try {
		const { command, args } = req.body as { command: string; args?: Array<any> };

		const argsArray = args || [] 
	
		const redisCast = redis as any
	
		const result = await redisCast[command](...argsArray)
		
		result ? res.status(200).send(result) : res.sendStatus(204)
	} catch (err) {
		res.status(500).send(err)
	}
})

!isProd && api.post('/reset', async (_, res) => {	
	await resetWebhooks().then(() => res.sendStatus(204)).catch(res.status(500).send)
})

export { api }


