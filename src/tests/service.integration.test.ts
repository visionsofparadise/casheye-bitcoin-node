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

it('executes rpc command', async () => {
	expect.assertions(1)

	const response = await axios.post(process.env.API_URL! + 'rpc', {
		command: 'getblockchaininfo'
	})

	logger.log(response.data);

	expect(response.data).toBeDefined();

	return;
}, 60 * 1000);

it(
	'adds an address, detects payment, confirms seven times then completes, then adds address, waits and expires',
	async () => {
		jest.useRealTimers();
		expect.assertions(9);

		const generateBlocksInitResponse = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: 'generate 101'
			}
		);

		logger.info(generateBlocksInitResponse);
		expect(generateBlocksInitResponse.status).toBe(200);

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

		await uDelay(3000);

		const sendToAddressResponse = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: `sendtoaddress ${address} 1`
			}
		);

		logger.info(sendToAddressResponse);
		expect(sendToAddressResponse.status).toBe(200);

		await uDelay(1 * 1000)

		const getAddressResponse1 = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: `getaddressinfo ${address}`
			}
		);

		logger.info(getAddressResponse1);
		expect(getAddressResponse1.data.label).toBe('confirming');

		const generateBlocks6Response = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: 'generate 6'
			}
		);

		logger.info(generateBlocks6Response);
		expect(generateBlocks6Response.status).toBe(200);

		await uDelay(1 * 1000)

		const getAddressResponse2 = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: `getaddressinfo ${address}`
			}
		);

		logger.info(getAddressResponse2);
		expect(getAddressResponse2.data.label).toBe('confirming');

		const generateBlocks1Response = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: 'generate 1'
			}
		);

		logger.info(generateBlocks1Response);
		expect(generateBlocks1Response.status).toBe(200);

		await uDelay(1 * 1000)

		const getAddressResponse3 = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: `getaddressinfo ${address}`
			}
		);

		logger.info(getAddressResponse3);
		expect(getAddressResponse3.data.label).toBe('used');

	/**
	 *  ADDRESS EXPIRATION
	 */

	const address2 = testAddressGenerator()

	const addAddressResponse2 = await axios.post(process.env.UTILITY_API_URL! + 'events', {
		event: {
			DetailType: 'addressCreated',
			Detail: {
				address,
				expiresAt: day().add(10, 'second').unix()
			}
		}
	});

	logger.info(addAddressResponse2.data);

	await uDelay(15 * 1000);

	const getAddressResponse4 = await axios.post<any>(
		process.env.API_URL! + 'rpc',
		{
			command: `getaddressinfo ${address}`
		}
	);

	logger.info(getAddressResponse4);
	expect(getAddressResponse4.data.label).toBe('expired');

	const sendToAddressResponse2 = await axios.post<any>(
		process.env.API_URL! + 'rpc',
		{
			command: `sendtoaddress ${address2} 1`
		}
	);

	logger.info(sendToAddressResponse2);
	expect(sendToAddressResponse2.status).toBe(200);

		await uDelay(1 * 1000)

		const getAddressResponse5 = await axios.post<any>(
			process.env.API_URL! + 'rpc',
			{
				command: `getaddressinfo ${address}`
			}
		);
	
		logger.info(getAddressResponse5);
		expect(getAddressResponse5.data.label).toBe('expired');

	return;
	},
	5 * 60 * 1000
);
