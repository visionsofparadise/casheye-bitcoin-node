import express, { Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isProd, logger } from '../../helpers';
import { rpc } from '../bitcoind/bitcoind'
import { resetWebhooks } from '../webhookManager/resetWebhooks';
import { redis } from '../../redis';

const api = express();

api.use(cors());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(bodyParser.json());

api.get('/', async (_, res) => res.sendStatus(200));

!isProd && api.post('/rpc', async (req, res, next) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	const result = await rpc[command](...argsArray).catch(next)

	result ? res.status(200).send(result) : res.sendStatus(204)
})

!isProd && api.post('/redis', async (req, res, next) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	const redisCast = redis as any

	const result = await redisCast[command](...argsArray).catch(next)

	result ? res.status(200).send(result) : res.sendStatus(204)
})

!isProd && api.post('/reset', async (_, res, next) => {	
	await resetWebhooks().catch(next)

	res.sendStatus(204)
})

!isProd && api.use((err: any, _: any, res: Response<any>, __: any) => {
	logger.error(err.stack)
	
  res.status(500).send(JSON.stringify(err))
})

export { api }


