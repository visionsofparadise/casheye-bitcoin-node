import { logger, sqs } from '../helpers';
import { getApis } from '../api'
import udelay from 'udelay'
import { btc } from '../bitcoind'
import axios from 'axios'
import kill from 'tree-kill'
import { getWatcher } from '../addressWatcher'

const { internalApi, externalApi } = getApis(btc)
const watcher = getWatcher(btc)

beforeAll(async () => {
	externalApi.listen(4000, () => console.log('Internal API listening on port 4000'))
	internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))
	watcher.watch()

	await udelay(5 * 1000)

	return
}, 10 * 1000)

const externalURL = 'http://127.0.0.1:4000/'

afterAll(async () => {
	await axios.post(externalURL + 'rpc', {
		command: 'stop'
	})

	await udelay(3 * 1000)

	kill(btc.pid)

	return
}, 20 * 1000)

it('health check', async () => {
	expect.assertions(1)

	const response = await axios.get(externalURL)

	logger.log(response.data);

	expect(response.status).toBe(200);

	return;
});

it('executes rpc command', async () => {
	expect.assertions(1)

	const response = await axios.post(externalURL + 'rpc', {
		command: 'getBlockchainInfo'
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
});

it('adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires', async () => {
	expect.assertions(7)

	for (let i = 0; i <= 101; i++ ) {
		await axios.post(externalURL + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(300)
	}

	const address = 'mwfjApeUk2uwAWuikWmjqnixW7Lg1mHNHE'

	const addAddressResponse = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			address,
			duration: 5 * 60 * 1000
		})
	}).promise()

	logger.log(addAddressResponse);

	expect(addAddressResponse.MessageId).toBeDefined();

	await udelay(3 * 1000)

	const sendToAddressResponse = await axios.post(externalURL + 'rpc', {
		command: 'sendToAddress',
		args: [address, 1]
	})

	logger.info(sendToAddressResponse)

	await udelay(3 * 1000)

	const getAddress1 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress1.data.label).toBe('confirming')

	for (let i = 0; i < 6; i++ ) {
		await axios.post(externalURL + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(300)
	}

	await udelay(3 * 1000)

	const getAddress2 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress2.data.label).toBe('confirming')

	await axios.post(externalURL + 'rpc', {
		command: 'generate',
		args: [1]
	})

	await udelay(3 * 1000)

	const getAddress3 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [address]
	})

	expect(getAddress3.data.label).toBe('used')

	/**
	 *  ADDRESS EXPIRATION
	 */

	const address2 = 'mz4JoMe93Bof3SJAN6iN2yGMGtMiZab2YW'

	const addAddress2Response = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			address: address2,
			duration: 1 * 1000
		})
	}).promise()

	logger.log(addAddress2Response);

	expect(addAddress2Response.MessageId).toBeDefined();

	await udelay(5 * 1000)

	const getAddress4 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [address2]
	})

	expect(getAddress4.data.label).toBe('expired')

	await axios.post(externalURL + 'rpc', {
		command: 'sendToAddress',
		args: [address2, 1]
	})

	await udelay(3 * 1000)

	const getAddress5 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [address2]
	})

	expect(getAddress5.data.label).toBe('expired')

	return;
}, 3 * 60 * 1000);
