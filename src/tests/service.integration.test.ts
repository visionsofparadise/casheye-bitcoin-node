import { logger } from '../helpers';
import axios from 'axios';
import uDelay from 'udelay';
import { testAddressGenerator } from '../testAddressGenerator'
import day from 'dayjs';

beforeAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

afterAll(async () => {
	await axios.post(process.env.UTILITY_API_URL + 'resetdb', {});
});

it(
	'adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires',
	async () => {
		jest.useRealTimers();
		expect.assertions(9);

		const generateBlocksInitResponse = await axios.post(process.env.UTILITY_API_URL! + 'events', {
			event: {
				DetailType: 'rpcCommand',
				Detail: {
					command: 'generate 101'
				}
			}
		});

		logger.info(generateBlocksInitResponse.data);

		await uDelay(5 * 1000);

		const address = testAddressGenerator()

		const addAddressResponse = await axios.post(process.env.UTILITY_API_URL! + 'events', {
			event: {
				DetailType: 'addressCreated',
				Detail: {
					address,
					expiresAt: day().add(5, 'minute').unix()
				}
			}
		});

		logger.info(addAddressResponse.data);

		await uDelay(3 * 1000);

		const sendToAddressResponse = await axios.post(process.env.UTILITY_API_URL! + 'events', {
			event: {
				DetailType: 'rpcCommand',
				Detail: {
					command: `sendtoaddress ${address} 1`
				}
			}
		});

		logger.info(sendToAddressResponse);

		await uDelay(1 * 1000)

		const testResults1Response = await axios.get<{ Items: Array<{ detailType: string }> }>(
			process.env.API_URL! + 'test-results'
		);

		logger.info(testResults1Response);

		const btcAddressWatchingEvents = testResults1Response.data.Items.filter(event => event.detailType === 'btcAddressWatching')
		const btcTxDetectedEvents = testResults1Response.data.Items.filter(event => event.detailType === 'btcTxDetected')

		expect(btcAddressWatchingEvents.length).toBe(1);
		expect(btcTxDetectedEvents.length).toBe(1);

		const generateBlocks6Response = await axios.post(process.env.UTILITY_API_URL! + 'events', {
			event: {
				DetailType: 'rpcCommand',
				Detail: {
					command: 'generate 6'
				}
			}
		});

		logger.info(generateBlocks6Response);

		await uDelay(1 * 1000)

		const testResults2Response = await axios.get<{ Items: Array<{ detailType: string }> }>(
			process.env.API_URL! + 'test-results'
		);

		logger.info(testResults2Response);

		const btcConfirmationEvents = testResults2Response.data.Items.filter(event => event.detailType === 'btcConfirmation')

		expect(btcConfirmationEvents.length).toBe(6);

		const generateBlocks1Response = await axios.post(process.env.UTILITY_API_URL! + 'events', {
			event: {
				DetailType: 'rpcCommand',
				Detail: {
					command: 'generate 1'
				}
			}
		});

		logger.info(generateBlocks1Response);

		await uDelay(1 * 1000)

		const testResults3Response = await axios.get<{ Items: Array<{ detailType: string }> }>(
			process.env.API_URL! + 'test-results'
		);

		logger.info(testResults3Response);

		const btcConfirmationEvents2 = testResults3Response.data.Items.filter(event => event.detailType === 'btcConfirmation')
		const btcAddressUsedEvents = testResults3Response.data.Items.filter(event => event.detailType === 'btcAddressUsed')

		expect(btcConfirmationEvents2.length).toBe(7);
		expect(btcAddressUsedEvents.length).toBe(1);

	/**
	 *  ADDRESS EXPIRATION
	 */

	const address2 = testAddressGenerator()

	const addAddress2Response = await axios.post(process.env.UTILITY_API_URL! + 'events', {
		event: {
			DetailType: 'addressCreated',
			Detail: {
				address: address2,
				expiresAt: day().add(10, 'second').unix()
			}
		}
	});

	logger.info(addAddress2Response.data);

	await uDelay(15 * 1000);

	const testResults4Response = await axios.get<{ Items: Array<{ detailType: string }> }>(
		process.env.API_URL! + 'test-results'
	);

	logger.info(testResults4Response);

	const btcAddressWatching2 = testResults4Response.data.Items.filter(event => event.detailType === 'btcAddressWatching')
	const btcAddressExpired = testResults4Response.data.Items.filter(event => event.detailType === 'btcAddressExpired')

	expect(btcAddressWatching2.length).toBe(2);
	expect(btcAddressExpired.length).toBe(1);

	const sendToAddress2Response = await axios.post(process.env.UTILITY_API_URL! + 'events', {
		event: {
			DetailType: 'rpcCommand',
			Detail: {
				command: `sendtoaddress ${address2} 1`
			}
		}
	});

	logger.info(sendToAddress2Response);

		await uDelay(1 * 1000)

		const testResults5Response = await axios.get<{ Items: Array<{ detailType: string }> }>(
			process.env.API_URL! + 'test-results'
		);
	
		logger.info(testResults5Response);

		const btcTxDetected2 = testResults5Response.data.Items.filter(event => event.detailType === 'btcTxDetected')
	
		expect(btcTxDetected2.length).toBe(1);

	return;
	},
	5 * 60 * 1000
);
