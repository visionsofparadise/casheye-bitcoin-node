import axios from "axios"
import { logger, wait } from "../helpers"

it('initializes funds in regtest bitcoin wallet', async () => {
	jest.useRealTimers()
	expect.assertions(1)
	
	for (let i = 0; i < 101; i++ ) {
		const generate1Response = await axios.post(process.env.INSTANCE_URL! + 'rpc', {
			command: 'generate',
			args: [1]
		})
	
		logger.info(generate1Response.status)
	
		await wait(500)
	}

	expect(true).toBe(true)
}, 5 * 60 * 1000)

