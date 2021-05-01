import express, { Response } from 'express';
import bodyParser from 'body-parser';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';
import day from 'dayjs'

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

	res.sendStatus(204)

	if (!result) {	
		await addressTxEvent(txid, timestamp).catch(next)
		await cloudLog(`new transaction: ${txid}`)
	}
})

api.post('/new-block/:blockhash/:timestamp', async (req, res, next) => {	
	const splitA = day().valueOf()
	const { blockhash, timestamp } = req.params

	res.sendStatus(204)

	const splitB = day().valueOf()
	newBlockEvent(blockhash, timestamp).catch(next)
	const splitC = day().valueOf()
	confirmationsEvent(blockhash, timestamp).catch(next)
	const splitD = day().valueOf()

	await Promise.all([newBlockEvent, confirmationsEvent]).catch(next)
	const splitE = day().valueOf()

	await cloudLog(`new block: ${blockhash}`)
	await cloudLog(`splits: ${[splitB - splitA, splitC - splitB, splitD - splitC, splitE - splitD]}`)
})	

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog(error)
	await cloudMetric('errors', [1])

	!res.writableEnded && res.sendStatus(204)
})

export { api }


