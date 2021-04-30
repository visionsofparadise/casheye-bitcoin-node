import express, { Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isProd } from '../../helpers';
import { rpc } from '../bitcoind/bitcoind'
import { resetWebhooks } from '../webhookManager/resetWebhooks';
import { redis } from '../../redis';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

const api = express();

api.use(cors());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(bodyParser.json());

api.get('/', async (_, res) => res.sendStatus(200));

!isProd && api.post('/rpc', async (req, res) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	const result = await rpc[command](...argsArray)
	
	result ? res.status(200).send(result) : res.sendStatus(204)
})

!isProd && api.post('/redis', async (req, res) => {	
	const { command, args } = req.body as { command: string; args?: Array<any> };

	const argsArray = args || [] 

	const redisCast = redis as any

	const result = await redisCast[command](...argsArray)
	
	result ? res.status(200).send(result) : res.sendStatus(204)
})

!isProd && api.post('/reset', async (_, res) => {	
	await resetWebhooks()

	res.sendStatus(204)
})

!isProd && api.post('/log-group-name', async (_, res) => res.status(204).send(process.env.LOG_GROUP_NAME))

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog(error)
	await cloudMetric('errors', [1])
	
  res.status(500).send('Server error')
})

export { api }


