import kuuid from 'kuuid'
import axios from "axios"
import { encode } from '../../webhookManager/webhookEncoder'
import { wait } from '../../../helpers'

it('triggers newBlock event', async () => {
	jest.useRealTimers()
	expect.assertions(4)

	const webhook = {
		id: kuuid.id(),
		userId: kuuid.id(),
		currency: 'BTC' as 'BTC',
		event: 'newBlock',
		url: process.env.TEST_URL!,
		node: 0
	}

	const redisPut = await axios.post(process.env.INSTANCE_URL! + 'redis', {
		command: 'hset',
		args: ['newBlock', webhook.id, encode(webhook)]
	})

	expect(redisPut.status).toBe(200)

	const generate1Response = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
		command: 'generate',
		args: [1]
	})

	expect(generate1Response.status).toBe(200)

	await wait(10 * 1000)

	const redisResponse = await axios.post<string[]>(process.env.INSTANCE_URL! + 'redis', {
		command: 'hvals',
		args: ['testData']
	})

	expect(redisResponse.status).toBe(200)
	
	const testData = redisResponse.data
		.map(data => JSON.parse(data) as { tx: any[] })
		.filter(data => data.tx ? true : false)

	expect(testData.length).toBe(1)
}, 5 * 60 * 1000)