import md5 from "md5"
import { wait } from "../../helpers"
import { redis } from "../../redis"
import { rpc } from "../bitcoind/bitcoind"
import fs from 'fs'
import { resolve } from 'path'
import flatten from "lodash/flatten"
import { sqs } from "../../sqs"
import { cloudLog } from "../cloudLogger/cloudLog"

export const resetWebhooks = async () => {
	cloudLog('turning off queue')

	await redis.set('webhookManagerState', '0')

	await wait(3 * 1000)

	const addressHash = await rpc.getAddressesByLabel('set') as Array<{ [address: string]: { purpose: string }}>

	const pipeline = redis.pipeline().hvals('newBlock').del('newBlock')

	for (const address of Object.keys(addressHash)) {
		pipeline.hvals(address).del(address)
	}

	const results = await pipeline.exec()

	cloudLog('webhooks deleted')

	const queueEntries = results.filter((_, index) => index % 2 === 0).map(result => {
		const encodedWebhooks = result[1] as string[]

		return encodedWebhooks.map(encodedWebhook => {
			const hash = md5(encodedWebhook)
		
			return {
				Id: hash,
				MessageBody: encodedWebhook
			}
		})
	})

	await sqs
		.sendMessageBatch({
			QueueUrl: process.env.SET_QUEUE_URL || 'set',
			Entries: flatten(queueEntries)
		})
		.promise();

	cloudLog('webhooks queued')

	await wait(3 * 1000)
	
	await rpc.unloadWallet('wallet')

	fs.unlinkSync(resolve(__dirname, '../bitcoind/wallet.dat'));

	cloudLog('bitcoind reset')

	cloudLog('system restart is ready')
}