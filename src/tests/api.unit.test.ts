import { logger } from '../helpers';
import { getApis } from '../api'
import udelay from 'udelay'
import { btc } from '../bitcoind'
import axios from 'axios'
import kill from 'tree-kill'

const { internalApi, externalApi } = getApis(btc)

beforeAll(async () => {
	externalApi.listen(4000, () => console.log('Internal API listening on port 4000'))

	await udelay(3 * 1000)

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
}, 10 * 1000);

it('executes rpc command', async () => {
	expect.assertions(1)

	const response = await axios.post(externalURL + 'rpc', {
		command: 'getblockchaininfo'
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
}, 60 * 1000);

it('adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires', async () => {
	expect.assertions(7)

	await btc.rpc.generate(101)

	await udelay(5 * 1000)

	internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))

	const address = 'mwfjApeUk2uwAWuikWmjqnixW7Lg1mHNHE'

	const addAddressResponse = await axios.post(externalURL + 'address', {
		address,
		duration: 5 * 60 * 1000
	})

	logger.log(addAddressResponse.data);

	expect(addAddressResponse.status).toBe(204);

	const sendToAddressResponse = await btc.rpc.sendToAddress(address, 1)

	logger.info(sendToAddressResponse)

	await udelay(1 * 1000)

	const getAddress1 = await btc.rpc.getAddressInfo(address)

	expect(getAddress1.label).toBe('confirming')

	await btc.rpc.generate(6)

	await udelay(1 * 1000)

	const getAddress2 = await btc.rpc.getAddressInfo(address)

	expect(getAddress2.label).toBe('confirming')

	await btc.rpc.generate(1)

	await udelay(1 * 1000)

	const getAddress3 = await btc.rpc.getAddressInfo(address)

	expect(getAddress3.label).toBe('used')

	/**
	 *  ADDRESS EXPIRATION
	 */

	const address2 = 'mz4JoMe93Bof3SJAN6iN2yGMGtMiZab2YW'

	const addAddress2Response = await axios.post(externalURL + 'address', {
		address: address2,
		duration: 1 * 1000
	})

	logger.log(addAddress2Response.data);

	expect(addAddress2Response.status).toBe(204);

	await udelay(5 * 1000)

	const getAddress4 = await btc.rpc.getAddressInfo(address2)

	expect(getAddress4.label).toBe('expired')

	await btc.rpc.sendToAddress(address2, 1)

	await udelay(1 * 1000)

	const getAddress5 = await btc.rpc.getAddressInfo(address2)

	expect(getAddress5.label).toBe('expired')

	return;
}, 5 * 60 * 1000);
