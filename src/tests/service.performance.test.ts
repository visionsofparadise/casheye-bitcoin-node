import { logger, sqs } from '../helpers';
import axios from 'axios';
import udelay from 'udelay'
import { testAddressGenerator } from '../testAddressGenerator'

const QueueUrl = process.env.QUEUE_URL!
const instanceUrl = process.env.INSTANCE_URL!
const n = process.env.PERFORMANCE_TEST_N ? parseInt(process.env.PERFORMANCE_TEST_N) : 100

beforeAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

afterAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

it(`initializes funds`, async () => {
	expect.assertions(1)

	logger.info('Initializing funds...')
	console.time('initialization')

	for (let i = 0; i < 101; i++ ) {
		await axios.post(instanceUrl + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(300)
	}

	console.timeEnd('initialization')
		
	expect(true).toBeTruthy()
	
	return;
}, 60 * 1000);

it(`adds ${n} addresses`, async () => {
	expect.assertions(2)

	logger.info('Generating messages...')
	console.time('messages')

	const messages = []

	for (let i = 0; i < n; i++) {
		messages.push({
			MessageGroupId: i.toString(),
			Id: i.toString(),
			MessageDeduplicationId: i.toString(),
			MessageBody: JSON.stringify({
				address: testAddressGenerator(i + (1000 * 1000)),
				duration: 15 * 60 * 1000
			})
		})
	}

	console.timeEnd('messages')
	logger.info(`${messages.length} messages generated out of ${n}`)

	expect(messages.length).toBe(n)

	logger.info('Adding messages to queue...')
	console.time('queueing')

	const queueResults = []

	for (let i = 0; i < n / 10; i++) {
		const result = await sqs.sendMessageBatch({
			QueueUrl,
			Entries: messages.slice(i, i + 10)
		}).promise()

		queueResults.push(result)
	}

	console.timeEnd('queueing')
	
	expect(queueResults.length).toBe(n / 10);

	const successfulQueues = queueResults.filter(result => result.Successful.length === 10)

	logger.info(`Queues ${successfulQueues.length} out of ${n / 10}`)
	
	return;
}, 10 * 60 * 1000);

it(`pays ${n} addresses`, async () => {
	expect.assertions(1)

	await udelay(5 * 60 * 1000)

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
	})

	await udelay(5 * 60 * 1000)

	console.time('verifying')

	const verificationResults = []

	for (let i = 0; i < n; i++) {
		const address = testAddressGenerator(i + (1000 * 1000))

		const result = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address]
		}).catch(error => error)

		verificationResults.push(result)
	}

	console.timeEnd('verifying')

	expect(verificationResults.length).toBe(n)

	const successfulVerifications = verificationResults.filter(result => result.data && result.data.label === 'confirming')

	logger.info(`Verifications ${successfulVerifications.length} out of ${n}`)
	logger.info({ results: verificationResults.map(result => result.data) })
	
	return;
}, 15 * 60 * 1000);