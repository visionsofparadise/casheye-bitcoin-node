import { wait } from '../../helpers'
import { setWebhook } from './setWebhook';
import { unsetWebhook } from './unsetWebhook';
import { redis } from '../../redis';
import { sqs } from '../../sqs'
import { webhookSetEvent, webhookUnsetEvent } from './events'
import { cloudError, cloudLog } from '../cloudLogger/cloudLog';
import { cloudMetric } from '../cloudLogger/cloudMetric';

export const webhookManager = async (): Promise<any> => {
	await cloudLog('webhook manager started')

	let isOn = await redis.get('webhookManagerState') || '1'
	
	while (true) {
		if (isOn === '1') {
			try {
				const SetQueueUrl = process.env.SET_QUEUE_URL! || 'set'
	
				const setQueueResponse = await sqs.receiveMessage({
					QueueUrl: SetQueueUrl,
					MaxNumberOfMessages: 10
				}).promise()
			
				const UnsetQueueUrl = process.env.UNSET_QUEUE_URL! || 'unset'
			
				const unsetQueueResponse = await sqs.receiveMessage({
					QueueUrl: UnsetQueueUrl,
					MaxNumberOfMessages: 10
				}).promise()
	
				await cloudLog({ isOn, setQueueResponse, unsetQueueResponse })
			
				const promises: Array<Promise<any>> = []
			
				if (setQueueResponse.Messages) {
					const messages = setQueueResponse.Messages.filter(msg => msg.Body)
			
					const results = await Promise.all(messages.map(async msg => setWebhook(msg).catch(async (error) => {
						await cloudLog({ error })

						return
					})))
			
					const successes = results.filter(result => result !== undefined)

					if (successes.length > 0) {
						const cloudMetricPromise = cloudMetric('webhooksSet', [successes.length])
						promises.push(cloudMetricPromise)

						const eventPromise = webhookSetEvent.send(successes.map(success => success!.eventEntry))
						promises.push(eventPromise)
		
						const sqsPromise = sqs.deleteMessageBatch({
							QueueUrl: SetQueueUrl,
							Entries: successes.map(success => (success!.queueEntry as any))
						}).promise()
			
						promises.push(sqsPromise)
					}
				}
			
				if (unsetQueueResponse.Messages) {
					const messages = unsetQueueResponse.Messages.filter(msg => msg.Body)
			
					const results = await Promise.all(messages.map(async msg => unsetWebhook(msg).catch(async (error) => {
						await cloudLog({ error })

						return
					})))
			
					const successes = results.filter(result => result !== undefined)

					if (successes.length > 0) {
						const cloudMetricPromise = cloudMetric('webhooksUnset', [successes.length])
						promises.push(cloudMetricPromise)

						const eventPromise = webhookUnsetEvent.send(successes.map(success => success!.eventEntry))
						promises.push(eventPromise)
				
						const sqsPromise = sqs.deleteMessageBatch({
							QueueUrl: UnsetQueueUrl,
							Entries: successes.map(success => (success!.queueEntry as any))
						}).promise()
			
						promises.push(sqsPromise)
					}
				}
	
				await Promise.all(promises)
			} catch (error) {
				await cloudError(error)
				await cloudMetric('errors', [1])
			}
		}

		await wait(1000)

		isOn = await redis.get('webhookManagerState') || '1'
	}
}