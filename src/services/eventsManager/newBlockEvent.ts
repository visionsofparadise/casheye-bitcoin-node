
import { redis, redisSub } from "../../redis"
import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"
import { cloudLog } from "../cloudLogger/cloudLog"
import day from 'dayjs'
import { translateLinuxTime } from "../../translateLinuxTime"

export const newBlockEvent = async (blockHash: string, requestStartTime: number) => {
	const processingStartTime = day().valueOf()
	const blockPromise = rpc.getBlock(blockHash, 1).catch(() => undefined) as Promise<any>

	const data = await redis.hvals('newBlock') as string[]

	const webhooks = data.map(webhook => decode(webhook))

	const block = await blockPromise

	if (!block) return

	await postEvents(webhooks.map(webhook => ({ webhook, payload: {
		...block,
		casheye: {
			requestStartTime,
			processingStartTime
		}
	} })))

	return
}

export const newBlockSubscription = async () => {
	const subscription = 'new-block'

	redisSub.subscribe(subscription);

	redisSub.on("message", async (channel, message) => {
		if (channel === subscription) {
			const [blockHash, timestamp] = message.split('#')

			const requestStartTime = translateLinuxTime(timestamp)

			await newBlockEvent(blockHash, requestStartTime).catch(cloudLog)
			await cloudLog(`new block: ${blockHash}`)
		}
	})
}