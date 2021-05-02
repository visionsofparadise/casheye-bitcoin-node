import express, { Response } from 'express';
import bodyParser from 'body-parser';
import { redis } from '../../redis';
import { addressTxEvent } from '../eventsManager/addressTxEvent';
import { confirmationsEvent } from '../eventsManager/confirmationsEvent';
import { newBlockEvent } from '../eventsManager/newBlockEvent';
import { cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';
import { translateLinuxTime } from '../../translateLinuxTime'
import day from 'dayjs'

const api = express();

api.use(bodyParser.json());

api.post('/new-tx/:txid/:timestamp', async (req, res, next) => {	
	const { txid, timestamp } = req.params

	const requestStartTime = translateLinuxTime(timestamp)
	const calibrationTime1 = day().valueOf() - requestStartTime
	
	const dedupKey = `dedup-${txid}`
	const data = await redis.multi()
		.get(dedupKey)
		.set(dedupKey, '1', 'EX', 10)
		.exec()

	const result = data[0][1]

	res.sendStatus(204)

	if (!result) {	
		await addressTxEvent(txid, timestamp).catch(next)
		await cloudLog(`new transaction: ${txid}`)

		const calibrationTime2 = day().valueOf() - requestStartTime
		await cloudLog({ route: 'tx', calibrationTime1, calibrationTime2 })
	}
})

api.post('/new-block/:blockhash/:timestamp', async (req, res, next) => {	
	const { blockhash, timestamp } = req.params

	const requestStartTime = translateLinuxTime(timestamp)
	const calibrationTime1 = day().valueOf() - requestStartTime

	res.sendStatus(204)

	const newBlockPromise = newBlockEvent(blockhash, timestamp).catch(next)
	const confirmationsPromise = confirmationsEvent(blockhash, timestamp).catch(next)
	
	await Promise.all([newBlockPromise, confirmationsPromise]).catch(next)
	await cloudLog(`new block: ${blockhash}`)

	const calibrationTime2 = day().valueOf() - requestStartTime
	await cloudLog({ route: 'block', calibrationTime1, calibrationTime2 })
})	

api.use(async (error: any, _: any, res: Response, __: any) => {
	await cloudLog({ error })
	await cloudMetric('errors', [1])

	!res.writableEnded && res.sendStatus(204)
})

export { api }


