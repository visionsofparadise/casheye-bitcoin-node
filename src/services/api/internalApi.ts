import express, { Response } from 'express';
import bodyParser from 'body-parser';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

const api = express();

api.use(bodyParser.json());

api.post('/new-tx/:txid/:timestamp', async (req, res, next) => {	
	const { txid, timestamp } = req.params

	const dedupKey = `dedup-${txid}`
	const dedupTx = await redis.multi()
		.get(dedupKey)
		.set(dedupKey, '1', 'EX', 10)
		.exec()
	const result = dedupTx[0][1]

	if (!result) {	
		const addressTxPromise = addressTxEvent(txid, timestamp).catch(next)
		const logPromise = cloudLog(`new transaction: ${txid}`)

		await Promise.all([addressTxPromise, logPromise]).catch(next)
	}

	res.sendStatus(204)
})

api.post('/new-block/:blockhash/:timestamp', async (req, res, next) => {	
	const { blockhash, timestamp } = req.params

	const newBlockPromise = newBlockEvent(blockhash, timestamp).catch(next)
	const confirmationsPromise = confirmationsEvent(blockhash, timestamp).catch(next)
	const logPromise = cloudLog(`new block: ${blockhash}`)

	await Promise.all([newBlockPromise, confirmationsPromise, logPromise]).catch(next)

	res.sendStatus(204)
})	

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog({ error })
	await cloudMetric('errors', [1])

	!res.writableEnded && res.sendStatus(204)
})

export { api }


