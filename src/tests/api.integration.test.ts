import axios from "axios"

it('responds success on health check', async () => {
	const response = await axios.get(process.env.INSTANCE_URL!)

	expect(response.status).toBe(200)
})

it('executes bitcoind command', async () => {
	const response = await axios.post(process.env.INSTANCE_URL! + '/rpc', {
		command: 'getBlockchainInfo',
		args: []
	})

	expect(response.status).toBe(200)
})

it('executes redis command', async () => {
	const response = await axios.post(process.env.INSTANCE_URL! + '/redis', {
		command: 'info',
		args: []
	})

	expect(response.status).toBe(200)
})