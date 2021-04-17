import { wait } from '../../../helpers'
import { redis } from '../../../redis'
import { setWebhook } from '../setWebhook'
import { unsetWebhook } from '../unsetWebhook'
import { webhookManager } from '../webhookManager'

jest.mock('ioredis', () => require('ioredis-mock/jest'));
jest.mock('../setWebhook', () => ({
	setWebhook: jest.fn().mockResolvedValue({
		eventEntry: {},
		queueEntry: {}
	})
}))
jest.mock('../unsetWebhook', () => ({
	unsetWebhook: jest.fn().mockResolvedValue({
		eventEntry: {},
		queueEntry: {}
	})
}))
jest.mock('../../../sqs', () => ({
	sqs: {
		receiveMessage: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue({
				Messages: [
					{
						Body: 'test'
					},
					{
						Body: 'test'
					}
				]
			})
		}),
		deleteMessageBatch: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	}
}))
jest.mock('../../../eventbridge', () => ({
	eventbridge: {
		putEvents: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue('success')
		})
	}
}))

jest.useRealTimers()

beforeEach(() => {
	redis.flushall()
})

it('executes handlers for queue items', async () => {
	jest.clearAllMocks()
	webhookManager()

	await wait(10 * 1000)

	expect(setWebhook).toBeCalled()
	expect(unsetWebhook).toBeCalled()
}, 30 * 1000)

it('doesnt if turned off', async () => {
	jest.clearAllMocks()
	redis.set('webhookManagerState', '0')
	webhookManager()

	await wait(10 * 1000)

	expect(setWebhook).not.toBeCalled()
	expect(unsetWebhook).not.toBeCalled()
}, 30 * 1000)