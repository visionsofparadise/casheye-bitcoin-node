import { logger } from '../../helpers'
import { redis } from '../../redis'

export const cloudLog = async (message: any) => {
	const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);

	await redis.zadd('logs', new Date().getTime(), formattedMessage)

	logger.info(formattedMessage)
}