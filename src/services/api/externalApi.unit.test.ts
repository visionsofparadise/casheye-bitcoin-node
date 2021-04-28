import axios from "axios"
import { logger } from "../../helpers";
import { redis } from "../../redis";
import { rpc } from "../bitcoind/bitcoind";
import { api } from './externalApi'

jest.mock('ioredis', () => require('ioredis-mock/jest'));
jest.mock('../bitcoind/bitcoind')

const port = 4000
const url = `http://localhost:${port}/`

beforeAll(() => {
	redis.flushall()

	api.listen(port, () => logger.info(`Server listening on port ${port}`))
})

it('responds success on health check', async () => {
	const response = await axios.get(url)

	expect(response.status).toBe(200)
})

it('executes bitcoind command', async () => {
	rpc.getBlockchainInfo.mockResolvedValue('success')

	const response = await axios.post(url + 'rpc', {
		command: 'getBlockchainInfo',
		args: []
	})

	expect(response.status).toBe(200)
	expect(rpc.getBlockchainInfo).toBeCalled()
})

it('executes redis command', async () => {
	const response = await axios.post(url + 'redis', {
		command: 'info',
		args: []
	})

	expect(response.status).toBe(200)
})