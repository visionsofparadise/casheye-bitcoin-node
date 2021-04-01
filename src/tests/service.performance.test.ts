import { eventbridge, logger, wait } from '../helpers';
import axios from 'axios';
import { testAddressGenerator } from '../testAddressGenerator'
import { Source } from '../helpers'
import day from 'dayjs'
import chunk from 'lodash/chunk'
import difference from 'lodash/difference'

const instanceUrl = process.env.INSTANCE_URL!
const n = process.env.PERFORMANCE_TEST_N ? parseInt(process.env.PERFORMANCE_TEST_N) : 200

it(`adds ${n} addresses`, async () => {
	try {
		expect.assertions(1)

		logger.info('Generating messages...')
		console.time('messages')
	
		const entries = []
	
		for (let i = 0; i < n; i++) {
			entries.push({
				Source,
				DetailType: 'addressCreated',
				Detail: JSON.stringify({
					pubKey: testAddressGenerator(i + (1000 * 1000)),
					currency: 'BTC',
					expiresAt: day().add(30, 'minute').unix()
				})
			})
		}

		logger.info('Adding addresses')

		const entriesBatched = chunk(entries, 10)

		await Promise.all(entriesBatched.map(async batch => {
			await eventbridge.putEvents({
				Entries: batch
			}).promise().catch(logger.error)

			await wait(1000)
		}))
	
		console.timeEnd('entries')
		logger.info(`${entries.length} entries generated and sent out of ${n}`)
	
		expect(entries.length).toBe(n)

		return;
	} catch (err) {
		logger.error(err)

		throw err
	}
}, 10 * 60 * 1000);

it(`pays ${n} addresses`, async () => {
	expect.assertions(1)

	await wait(5 * 60 * 1000)

	logger.info('Sending to addresses...')
	console.time('sending')

	const sendResults = []

	for (let i = 0; i < n; i++) {
		const address = testAddressGenerator(i + (1000 * 1000))
		const amount = 1 / n

		const result = await axios.post(instanceUrl + 'rpc', {
			command: 'sendToAddress',
			args: [address, amount]
		}).catch(error => error)

		sendResults.push(result)
	}

	console.timeEnd('sending')

	expect(sendResults.length).toBe(n);

	const successfulSends = sendResults.filter(result => result.status && result.status === 200)

	logger.info(`Sends ${successfulSends.length} out of ${n}`)
	
	return;
}, 15 * 60 * 1000);

it(`verifies ${n} addresses have been paid`, async () => {
	expect.assertions(1)

	logger.info('Generating block...')

	await axios.post(instanceUrl + 'rpc', {
		command: 'generate',
		args: [1]
	}).catch(error => error)

	logger.info('waiting for confirmation 5 minutes...')

	await wait(5 * 60 * 1000)

	const response = await axios.post<Array<{ label: string; confirmations: number }>>(instanceUrl + 'rpc', {
		command: 'listReceivedByAddress',
		args: [undefined, false, true]
	})

	const result = response.data.filter(receivedBy => receivedBy.label === 'confirming' && receivedBy.confirmations === 1)

	const diff = difference(response.data, result)

	logger.info(`Verifications ${result.length} out of ${n}`)
	logger.info({ diff })

	expect(result.length).toBe(n)
	
	return;
}, 15 * 60 * 1000);