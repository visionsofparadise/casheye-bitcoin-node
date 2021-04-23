import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { isProd } from '../../helpers';
import { rpc } from '../bitcoind/bitcoind'
import { resetWebhooks } from '../webhookManager/resetWebhooks';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';
import kuuid from 'kuuid';

const api = express();

api.use(cors());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(bodyParser.json());

api.get('/', async (_, res) => res.sendStatus(200));

api.post('/new-tx/:txid', async (req, res) => {	
	const { txid } = req.params

	const dedupKey = `dedup-${txid}`
	const dedupTx = await redis.multi().get(dedupKey).set(dedupKey, 'true', 'EX', 10).exec()
	const result = dedupTx[0][1]

	res.sendStatus(204)

	if (!result) {	
		await addressTxEvent(txid, req.body.timestamp).catch(async error => {
			if (process.env.STAGE !== 'prod') {
				await redis.hset('errors', kuuid.id(), JSON.stringify(error))
			}
	
			throw error
		})
	}
})

api.post('/new-block/:blockhash', async (req, res) => {	
	const { blockhash } = req.params
	const { timestamp } = req.body

	res.sendStatus(204)

	try {
		const confirmationsPromise = confirmationsEvent(blockhash, timestamp)
		const newBlockPromise = newBlockEvent(blockhash, timestamp)

		await Promise.all([confirmationsPromise, newBlockPromise])
	} catch (error) {
		if (process.env.STAGE !== 'prod') {
			await redis.hset('errors', kuuid.id(), JSON.stringify(error))
		}

		throw error
	}
})

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


