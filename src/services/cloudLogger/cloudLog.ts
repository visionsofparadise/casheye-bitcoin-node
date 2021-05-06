import { logger } from '../../helpers'
import { redis } from '../../redis'

export const cloudLog = async (message: any) => {
	const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);

	const log = {
		timestamp: new Date().getTime(),
		message: formattedMessage
	}

	await redis.lpush('logs', JSON.stringify(log))

	logger.info(formattedMessage)
}

export const cloudError = async (message: any) => {
	let error = message

	if (!error.stack) error = { error, stack: new Error().stack }

	await cloudLog(error)
}