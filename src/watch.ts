import { isUnitTest, logger, sqs } from './helpers'
import { watchAddresses } from './watchAddress'

export const watch = async (): Promise<any> => {
	const QueueUrl = process.env.QUEUE_URL || 'test'

	const response = await sqs.receiveMessage({
		QueueUrl,
		MaxNumberOfMessages: 10
	}).promise()

	if (response.Messages) {
		logger.info(response.Messages)

		const filteredMessages = response.Messages.filter(msg => msg.Body)

		const batchedMessages = filteredMessages.map(msg => {
			const data = JSON.parse(msg.Body!) as { address: string; duration: number }

			return data
		})

		await watchAddresses(batchedMessages)

		if (isUnitTest) {
			await Promise.all(filteredMessages.map(async result => {
				await sqs.deleteMessage({
					QueueUrl,
					ReceiptHandle: result.ReceiptHandle
				} as any).promise()
			}))
		} else {
			await sqs.deleteMessageBatch({
				QueueUrl,
				Entries: filteredMessages.map(result => ({
					Id: result.MessageId!,
					ReceiptHandle: result.ReceiptHandle!
				} as any))
			}).promise()
		}

		return watch()
	}

	return setTimeout(watch, 1000)
}