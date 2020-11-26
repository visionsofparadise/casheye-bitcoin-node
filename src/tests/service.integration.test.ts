import { logger } from '../helpers';
import axios from 'axios';
import udelay from 'udelay'
import { testAddressGenerator } from '../testAddressGenerator'

const secret = process.env.SECRET

const client = axios.create({
	headers: {
		authorization: secret
	},
	timeout: 10 * 60 * 1000
})

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
}, 10 * 1000);

it('executes rpc command', async () => {
	expect.assertions(1)

	const response = await client.post(instanceUrl + 'rpc', {
		command: 'getBlockchainInfo'
	},
	{
		headers: {
			authorization: secret
		}
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
}, 60 * 1000);

it('rejects unauthorized', async () => {
	expect.assertions(1)

	await axios.post(instanceUrl + 'rpc', {
		command: 'getBlockchainInfo'
	}).catch(error => expect(error).toBeDefined())

	return;
}, 60 * 1000);

it('adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires', async () => {
	expect.assertions(7)

	await udelay(10 * 1000)

	await client.post(instanceUrl + 'rpc', {
		command: 'generate',
		args: [101]
	}, {
		timeout: 5 * 60 * 1000
	})

	await udelay(2 * 60 * 1000)

	const address = testAddressGenerator()

	const addAddressResponse = await client.post(instanceUrl + 'address', {
		address,
		duration: 5 * 60 * 1000
	})

	logger.log(addAddressResponse.data);

	expect(addAddressResponse.status).toBe(204);

	const sendToAddressResponse = await client.post(instanceUrl + 'rpc', {
		command: 'sendToAddress',
		args: [address, 1]
	})

	logger.info(sendToAddressResponse)

	await udelay(1 * 1000)

	const getAddress1 = await client.post(instanceUrl + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress1.data.label).toBe('confirming')

	await client.post(instanceUrl + 'rpc', {
		command: 'generate',
		args: [6]
	})

	await udelay(3 * 1000)

	const getAddress2 = await client.post(instanceUrl + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress2.data.label).toBe('confirming')

	await client.post(instanceUrl + 'rpc', {
		command: 'generate',
		args: [1]
	})

	await udelay(1 * 1000)

	const getAddress3 = await client.post(instanceUrl + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress3.data.label).toBe('used')

	/**
	 *  ADDRESS EXPIRATION
	 */

	const address2 = testAddressGenerator()

	const addAddress2Response = await client.post(instanceUrl + 'address', {
		address: address2,
		duration: 1 * 1000
	})

	logger.log(addAddress2Response.data);

	expect(addAddress2Response.status).toBe(204);

	await udelay(5 * 1000)

	const getAddress4 = await client.post(instanceUrl + 'rpc', {
		command: 'getAddressInfo',
		args: [address2]
	})

	expect(getAddress4.data.label).toBe('expired')

	await client.post(instanceUrl + 'rpc', {
		command: 'sendToAddress',
		args: [address2, 1]
	})

	await udelay(1 * 1000)

	const getAddress5 = await client.post(instanceUrl + 'rpc', {
		command: 'getAddressInfo',
		args: [address2]
	})

	expect(getAddress5.data.label).toBe('expired')

	return;
}, 5 * 60 * 1000);
