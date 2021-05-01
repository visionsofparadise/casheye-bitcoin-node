
import { redis } from "../../redis"
import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"

export const newBlockEvent = async (blockHash: string, requestStartTime: string) => {
	const blockPromise = rpc.getBlock(blockHash, 1).catch(() => undefined) as Promise<any>

	const data = await redis.hvals('newBlock') as string[]

	const webhooks = data.map(webhook => decode(webhook))

	const block = await blockPromise

	if (!block) return

	await postEvents(webhooks.map(webhook => ({ webhook, payload: {
		requestStartTime,
		...block
	} })), 'newBlock')

	return
}