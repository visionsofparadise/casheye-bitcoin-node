
import { redis } from "../../redis"
import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"

export const newBlockEvent = async (blockHash: string, requestStartTime: number) => {
	const blockPromise = rpc.getBlock(blockHash, 2).catch(() => undefined) as Promise<any>

	const data = await redis.hvals('newBlock') as string[]

	const webhooks = data.map(webhook => decode(webhook))

	const block = await Promise.resolve(blockPromise)

	if (!block) return

	return postEvents(webhooks.map(webhook => ({ webhook, payload: block })), requestStartTime)
}