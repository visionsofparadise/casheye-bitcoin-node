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

api.post('/new-tx/:txid', async (req, res) => {	
	const { txid } = req.params

	const dedupKey = `dedup-${txid}`
	const dedupTx = await redis.multi()
		.get(dedupKey)
		.set(dedupKey, '1', 'EX', 10)
		.exec()
	const result = dedupTx[0][1]

	res.sendStatus(204)

	if (!result) {	
		await cloudLog(`new transaction: ${txid}`)
		await addressTxEvent(txid, req.body.timestamp)
	}
})

api.post('/new-block/:blockhash', async (req, res) => {	
	const { blockhash } = req.params
	const { timestamp } = req.body

	res.sendStatus(204)

	await cloudLog(`new block: ${blockhash}`)
	const newBlockPromise = newBlockEvent(blockhash, timestamp)
	const confirmationsPromise = confirmationsEvent(blockhash, timestamp)

	await Promise.resolve(newBlockPromise)
	await Promise.resolve(confirmationsPromise)
})

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog(error)
	await cloudMetric('errors', [1])

	!res.writableEnded && res.sendStatus(204)
})

export { api }

