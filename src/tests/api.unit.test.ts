import { logger, sqs } from '../helpers';
import { internalApi, externalApi } from '../api'
import udelay from 'udelay'
import { startBTC } from '../bitcoind'
import axios from 'axios'
import { watch } from '../watch'
import day from 'dayjs'

beforeAll(async () => {
	startBTC()

	await udelay(3 * 1000)

	internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))
	externalApi.listen(4000, () => console.log('Internal API listening on port 4000'))
	watch()

	await udelay(3 * 1000)

	return
}, 10 * 1000)

const externalURL = 'http://127.0.0.1:4000/'

afterAll(async () => {
	await axios.post(externalURL + 'rpc', {
		command: 'stop'
	})

	await udelay(3 * 1000)

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

		await udelay(100)
	}

	const pubKey = 'mwfjApeUk2uwAWuikWmjqnixW7Lg1mHNHE'

	const addAddressResponse = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			pubKey,
			expiresAt: day().add(5, 'minute').valueOf()
		})
	}).promise()

	logger.log(addAddressResponse);

	expect(addAddressResponse.MessageId).toBeDefined();

	await udelay(1000)

	const sendToAddressResponse = await axios.post(externalURL + 'rpc', {
		command: 'sendToAddress',
		args: [pubKey, 1]
	})

	logger.info(sendToAddressResponse)

	await udelay(1000)

	const getAddress1 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey]
	})

	expect(getAddress1.data.label).toBe('confirming')

	for (let i = 0; i < 5; i++ ) {
		await axios.post(externalURL + 'rpc', {
			command: 'generate',
			args: [1]
		})

		await udelay(100)
	}

	await udelay(1000)

	const getAddress2 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey]
	})

	expect(getAddress2.data.label).toBe('confirming')

	await axios.post(externalURL + 'rpc', {
		command: 'generate',
		args: [1]
	})

	await udelay(1000)

	const getAddress3 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey]
	})

	expect(getAddress3.data.label).toBe('used')

	/**
	 *  ADDRESS EXPIRATION
	 */

	const pubKey2 = 'mz4JoMe93Bof3SJAN6iN2yGMGtMiZab2YW'

	const addAddress2Response = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			pubKey: pubKey2,
			expiresAt: day().add(1, 'second').valueOf()
		})
	}).promise()

	logger.log(addAddress2Response);

	expect(addAddress2Response.MessageId).toBeDefined();

	await udelay(3 * 1000)

	const getAddress4 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey2]
	})

	expect(getAddress4.data.label).toBe('expired')

	await axios.post(externalURL + 'rpc', {
		command: 'sendToAddress',
		args: [pubKey2, 1]
	})

	await udelay(1000)

	const getAddress5 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey2]
	})

	expect(getAddress5.data.label).toBe('expired')

	return;
}, 3 * 60 * 1000);

it('relabels an expired address to watching', async () => {
	expect.assertions(4)

	const pubKey = 'mzMB8zZAB1kmnA8xDccgtQQvcL2w6k9MMK'

	const addAddressResponse = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			pubKey,
			expiresAt: day().add(1, 'second').valueOf()
		})
	}).promise()

	logger.log(addAddressResponse);

	expect(addAddressResponse.MessageId).toBeDefined();

	await udelay(3000)

	const getAddress1 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey]
	})

	expect(getAddress1.data.label).toBe('expired')

	const addAddressResponse2 = await sqs.sendMessage({
		QueueUrl: 'test',
		MessageBody: JSON.stringify({
			pubKey,
			expiresAt: day().add(5, 'minute').valueOf()
		})
	}).promise()

	logger.log(addAddressResponse2);

	expect(addAddressResponse2.MessageId).toBeDefined();

	await udelay(1000)

	const getAddress2 = await axios.post(externalURL + 'rpc', {
		command: 'getAddressInfo',
		args: [pubKey]
	})

	expect(getAddress2.data.label).toBe('watching')

	return
}, 3 * 60 * 1000);