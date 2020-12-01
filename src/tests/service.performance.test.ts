import { logger, sqs } from '../helpers';
import axios from 'axios';
import udelay from 'udelay'
import { testAddressGenerator } from '../testAddressGenerator'
import { nanoid } from 'nanoid';
import day from 'dayjs'

const QueueUrl = process.env.QUEUE_URL!
const instanceUrl = process.env.INSTANCE_URL!

beforeAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

afterAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

const n = process.env.PERFORMANCE_TEST_N ? parseInt(process.env.PERFORMANCE_TEST_N) : 1000

it(`adds and pays${n} addresses, then generates a block`, async () => {
	expect.assertions(4)

	try {
		logger.info('Initializing funds...')

		const initFundsStart = day().unix()

		for (let i = 0; i < 101; i++ ) {
			await axios.post(instanceUrl + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			await udelay(500)
		}

		const initFundsFinish = day().unix()
		const initFundsDuration = ((initFundsStart - initFundsFinish) / 1000).toFixed(2)

		logger.info(`Initialized funds in ${initFundsDuration}s`)
		logger.info('Generating messages...')

		const messages = []

		for (let i = 0; i < n; i++) {
			messages.push({
				MessageGroupId: nanoid(),
				Id: nanoid(),
				MessageDeduplicationId: nanoid(),
				MessageBody: JSON.stringify({
					address: testAddressGenerator(i + (1000 * 1000)),
					duration: 5 * 60 * 1000
				})
			})
		}

		logger.info(`${messages.length} messages generated out of ${n}`)

		expect(messages.length).toBe(n)

		logger.info('Adding messages to queue...')

		const queueStart = day().unix()

		const queueResults = []

		for (let i = 0; i < n / 10; i++) {
			const result = await sqs.sendMessageBatch({
				QueueUrl,
				Entries: messages.slice(i, i + 10)
			}).promise()

			queueResults.push(result)
		}

		const queueFinish = day().unix()
		const queueDuration = ((queueStart - queueFinish) / 1000).toFixed(2)

		expect(queueResults.length).toBe(n / 10);

		const successfulQueues = queueResults.filter(result => result.Successful.length === 10)

		logger.info(`Queues ${successfulQueues.length} out of ${n}`)
		logger.info(`Queued messages in ${queueDuration}s`)

		logger.info('Sending to addresses...')

		const sendStart = day().unix()

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

		const sendFinish = day().unix()
		const sendDuration = ((sendStart - sendFinish) / 1000).toFixed(2)

		expect(sendResults.length).toBe(n);

		const successfulSends = sendResults.filter(result => result.status && result.status === '200')

		logger.info(`Sends ${successfulSends.length} out of ${n}`)
		logger.info(`Sent to addresses in ${sendDuration}s`)

		logger.info('Generating block...')

		await axios.post(instanceUrl + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(30 * 1000)

		logger.info('Performing health check...')

		const response = await axios.get(instanceUrl)

		logger.log(response.data);
	
		expect(response.status).toBe(200);
	
	} catch (err) {
		logger.error(err)

		throw err
	}
	
	return;
}, 30 * 60 * 1000);
