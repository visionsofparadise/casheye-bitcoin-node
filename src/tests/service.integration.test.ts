import { logger, sqs } from '../helpers';
import axios from 'axios';
import udelay from 'udelay'
import { testAddressGenerator } from '../testAddressGenerator'
import { nanoid } from 'nanoid';

const client = axios.create({
	headers: {
		authorization: process.env.SECRET!
	},
	
})

const QueueUrl = process.env.QUEUE_URL!

beforeAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

afterAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

const instanceUrl = process.env.INSTANCE_URL!

it('health check', async () => {
	expect.assertions(1)

	const response = await axios.get(instanceUrl)

	logger.log(response.data);

	expect(response.status).toBe(200);

	return;
});

it('executes rpc command', async () => {
	expect.assertions(1)

	const response = await client.post(instanceUrl + 'rpc', {
		command: 'getBlockchainInfo'
	}).catch(error => {
		logger.error({ error })

		throw error
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
});

it('rejects unauthorized', async () => {
	expect.assertions(1)

	await axios.post(instanceUrl + 'rpc', {
		command: 'getBlockchainInfo'
	}).catch(error => expect(error).toBeDefined())

	return;
});

it('adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires', async () => {
	expect.assertions(7)

	try {
		for (let i = 0; i < 101; i++ ) {
			const generate1Response = await client.post(instanceUrl + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generate1Response.status)
		
			await udelay(500)
		}
	
		const address = testAddressGenerator()
	
		const addAddressResponse = await sqs.sendMessage({
			QueueUrl,
			MessageDeduplicationId: nanoid(),
			MessageGroupId: nanoid(),
			MessageBody: JSON.stringify({
				address,
				duration: 5 * 60 * 1000
			})
		}).promise()
	
		logger.log(addAddressResponse);
	
		expect(addAddressResponse.MessageId).toBeDefined();

		await udelay(3 * 1000)
	
		const sendToAddressResponse = await client.post(instanceUrl + 'rpc', {
			command: 'sendToAddress',
			args: [address, 1]
		})
	
		logger.info(sendToAddressResponse.data)
	
		await udelay(3 * 1000)
	
		const getAddress1 = await client.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address]
		})
	
		expect(getAddress1.data.label).toBe('confirming')
	
		for (let i = 0; i < 6; i++ ) {
			const generate6Response = await client.post(instanceUrl + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generate6Response.status)
		
			await udelay(500)
		}
	
		const getAddress2 = await client.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address]
		})
	
		expect(getAddress2.data.label).toBe('confirming')
	
		await client.post(instanceUrl + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(2 * 1000)
	
		const getAddress3 = await client.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address]
		})
	
		expect(getAddress3.data.label).toBe('used')
	
		/**
		 *  ADDRESS EXPIRATION
		 */
	
		const address2 = testAddressGenerator()
	
		const addAddress2Response = await sqs.sendMessage({
			QueueUrl: 'test',
			MessageDeduplicationId: nanoid(),
			MessageGroupId: nanoid(),
			MessageBody: JSON.stringify({
				address: address2,
				duration: 1 * 1000
			})
		}).promise()
	
		logger.log(addAddress2Response);
	
		expect(addAddress2Response.MessageId).toBeDefined();
	
		await udelay(6 * 1000)
	
		const getAddress4 = await client.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address2]
		})
	
		expect(getAddress4.data.label).toBe('expired')
	
		await client.post(instanceUrl + 'rpc', {
			command: 'sendToAddress',
			args: [address2, 1]
		})
	
		await udelay(3 * 1000)
	
		const getAddress5 = await client.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [address2]
		})
	
		expect(getAddress5.data.label).toBe('expired')
	} catch (err) {
		logger.error(err)

		throw err
	}
	
	return;
}, 10 * 60 * 1000);
