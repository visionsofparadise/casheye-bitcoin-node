import { logger } from '../../helpers'
import { redis } from '../../redis'
import day from 'dayjs'

export const cloudLog = async (message: any) => {
	const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);

	await redis.zadd('logs', 'NX', day().valueOf(), formattedMessage)

	logger.info(formattedMessage)
}