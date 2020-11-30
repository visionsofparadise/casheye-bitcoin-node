import { logger, sqs } from './helpers'
import { watchAddress } from './watchAddress'
import { DeleteMessageRequest } from 'aws-sdk/clients/sqs'

export const getWatcher = (btc: any) => {
	const watch = async () => {
		const QueueUrl = process.env.QUEUE_URL || 'test'
	
		logger.info('Checking for messages...')
	
		const response = await sqs.receiveMessage({
			QueueUrl,
			MaxNumberOfMessages: 10
		}).promise()
	
		if (response.Messages) {
			logger.info(response.Messages)
	
			const results = await Promise.all(response.Messages.map(async (msg) => {
				try {
					if (!msg.Body) throw Error('No body')
	
					const data = JSON.parse(msg.Body) as { address: string; duration: number }
	
					await watchAddress(data.address, data.duration, btc)
	
					return {
						...msg,
						isWatched: true
					}
				} catch (err) {
					logger.error(err)
	
					return {
						...msg,
						isWatched: false
					}
				}
			}))
	
			const success = results.filter(result => result)

			await Promise.all(success.map(async result => {
				await sqs.deleteMessage({
					QueueUrl,
					ReceiptHandle: result.ReceiptHandle
				} as DeleteMessageRequest).promise()
			}))
		}
	
		return setTimeout(watch, 1000)
	}

	return {
		watch
	}
}
