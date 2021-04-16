
import { redis } from "../../redis"
import { postEvents } from "./postEvents"
import { rpc } from "../bitcoind/bitcoind"
import { decode } from "../webhookManager/webhookEncoder"
import { logger } from '../../helpers';

export const newBlockEvent = async (blockHash: string) => {
	const blockPromise = rpc.getBlock(blockHash, 2) as Promise<any>

	const data = await redis.hvals('newBlock') as string[]

	const webhooks = data.map(webhook => decode(webhook))

	const block = await Promise.resolve(blockPromise)

	return postEvents(webhooks.map(webhook => ({ webhook, payload: block })))
}

export const newBlockSubscriber = async () => {
	redis.on("message", (_: any, message: string) => {
		newBlockEvent(message).catch(logger.error)
	})

	redis.subscribe("newBlock")

	logger.info('newBlock listening')

	return
}