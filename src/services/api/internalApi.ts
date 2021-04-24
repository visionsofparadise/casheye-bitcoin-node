import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
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
		await newBlockEvent(blockhash, timestamp)
		await confirmationsEvent(blockhash, timestamp)
	} catch (error) {
		if (process.env.STAGE !== 'prod') {
			await redis.hset('errors', kuuid.id(), JSON.stringify(error))
		}

		throw error
	}
})

export { api }


