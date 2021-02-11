import { eventbridge, logger } from '../helpers';
import axios from 'axios';
import udelay from 'udelay'
import { testAddressGenerator } from '../testAddressGenerator'
import day from 'dayjs'

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

	const response = await axios.post(instanceUrl + 'rpc', {
		command: 'getBlockchainInfo'
	}).catch(error => {
		logger.error({ error })

		throw error
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
});

it('adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires', async () => {
	expect.assertions(5)

	try {
		for (let i = 0; i < 101; i++ ) {
			const generate1Response = await axios.post(instanceUrl + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generate1Response.status)
		
			await udelay(300)
		}
	
		const pubKey = testAddressGenerator()

		const event = {
			Source: 'casheye-' + process.env.STAGE!,
			DetailType: 'addressCreated',
			Detail: JSON.stringify({
				pubKey,
				expiresAt: day().add(5, 'minute').valueOf()
			})
		}

		logger.info({ event })

		await eventbridge.putEvents({
			Entries: [event]
		}).promise()

		await udelay(5 * 1000)
	
		const sendToAddressResponse = await axios.post(instanceUrl + 'rpc', {
			command: 'sendToAddress',
			args: [pubKey, 1]
		})
	
		logger.info(sendToAddressResponse.data)
	
		await udelay(3 * 1000)
	
		const getAddress1 = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [pubKey]
		})
	
		expect(getAddress1.data.label).toBe('confirming')
	
		for (let i = 0; i < 5; i++ ) {
			const generate6Response = await axios.post(instanceUrl + 'rpc', {
				command: 'generate',
				args: [1]
			})
		
			logger.info(generate6Response.status)
		
			await udelay(300)
		}
	
		const getAddress2 = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [pubKey]
		})
	
		expect(getAddress2.data.label).toBe('confirming')
	
		await axios.post(instanceUrl + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		await udelay(10 * 1000)
	
		const getAddress3 = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [pubKey]
		})
	
		expect(getAddress3.data.label).toBe('used')
	
		/**
		 *  ADDRESS EXPIRATION
		 */
	
		const pubKey2 = testAddressGenerator()

		await eventbridge.putEvents({
			Entries: [{
				Source: 'casheye-' + process.env.STAGE!,
				DetailType: 'addressCreated',
				Detail: JSON.stringify({
					pubKey: pubKey2,
					expiresAt: day().add(1, 'second').valueOf()
				})
			}]
		}).promise()
	
		await udelay(6 * 1000)
	
		const getAddress4 = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [pubKey2]
		})
	
		expect(getAddress4.data.label).toBe('expired')
	
		await axios.post(instanceUrl + 'rpc', {
			command: 'sendToAddress',
			args: [pubKey2, 1]
		})
	
		await udelay(3 * 1000)
	
		const getAddress5 = await axios.post(instanceUrl + 'rpc', {
			command: 'getAddressInfo',
			args: [pubKey2]
		})
	
		expect(getAddress5.data.label).toBe('expired')
	} catch (err) {
		logger.error(err)

		throw err
	}
	
	return;
}, 10 * 60 * 1000);
