
import { redis, redisSub } from "../../redis"
import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"
import { cloudLog } from "../cloudLogger/cloudLog"
import { translateLinuxTime } from "../../translateLinuxTime"

export const newBlockEvent = async (blockHash: string, requestStartTime: number) => {
	const processingStartTime = new Date().getTime()
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

	redisSub.on("message", async (channel, message) => {
		const [blockHash, timestamp] = message.split('#')

		if (channel === subscription) {
			const requestStartTime = translateLinuxTime(timestamp)
			
			await newBlockEvent(blockHash, requestStartTime).catch(cloudLog)
		}
	})

	redisSub.subscribe(subscription);
}