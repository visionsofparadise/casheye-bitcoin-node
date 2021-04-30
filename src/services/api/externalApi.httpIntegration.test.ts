import axios from "axios"
import { logger } from "../../helpers"

it('responds success on health check', async () => {
	const response = await axios.get(process.env.INSTANCE_URL!)

	expect(response.status).toBe(200)
})

it('executes bitcoind command', async () => {
	const response = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'getBlockchainInfo',
		args: []
	})

	expect(response.status).toBe(200)
})

it('executes redis command', async () => {
	const response = await axios.post(process.env.INSTANCE_URL! + 'redis', {
		command: 'info',
		args: []
	})

	expect(response.status).toBe(200)
})

it('responds log group name', async () => {
	const response = await axios.get(process.env.INSTANCE_URL! + 'log-group-name')

	logger.info({ logGroupName: response.data })

	expect(response.status).toBe(200)
})