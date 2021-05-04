
import { redis } from "../../redis"
import { postEvents } from "./postEvents"
import { zeromqUrl } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"
import { cloudLog } from "../cloudLogger/cloudLog"
import zmq from 'zeromq'
import { Block } from 'bitcore-lib'

export const newBlockEvent = async (rawBlockHex: Buffer, requestStartTime: number) => {
	const processingStartTime = new Date().getTime()

	const block = new Block(rawBlockHex)

	if (!block) return

	const data = await redis.hvals('newBlock') as string[]

	const webhooks = data.map(webhook => decode(webhook))

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
	const sub = zmq.socket('sub')
	sub.connect(zeromqUrl)

	const subscription = 'rawblock'

	sub.on("message", async (channel, rawBlockHex) => {
		const requestStartTime = new Date().getTime()

		if (channel.toString() === subscription) await newBlockEvent(rawBlockHex, requestStartTime).catch(cloudLog)
	})

	sub.subscribe(subscription);
}