import axios from 'axios'
import day from 'dayjs'
import kuuid from 'kuuid'
import { logger, wait } from '../../helpers'
import { redis } from '../../redis'
import { addressTxEvent } from '../eventsManager/addressTxEvent'
import { confirmationsEvent } from '../eventsManager/confirmationsEvent'
import { newBlockEvent } from '../eventsManager/newBlockEvent'
import { api } from './internalApi'

const port = 3000
const url = `http://localhost:${port}/`

jest.mock('ioredis', () => require('ioredis-mock/jest'));
jest.mock('../eventsManager/addressTxEvent', () => ({
	addressTxEvent: jest.fn().mockResolvedValue('success')
}))
jest.mock('../eventsManager/confirmationsEvent')
jest.mock('../eventsManager/newBlockEvent')

beforeAll(() => {
	redis.flushall()

	api.listen(port, () => logger.info(`Server listening on port ${port}`))
})

it('calls addressTx event', async () => {
	jest.clearAllMocks()
	const txId = kuuid.id()

	const response = await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)

	expect(response.status).toBe(204)

	await wait(500)
	
	expect(addressTxEvent).toHaveBeenCalled()
})

it('deduplicates addressTx event', async () => {
	jest.clearAllMocks()
	const txId = kuuid.id()

	await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)
	await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)
	await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)
	await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)
	await axios.post(url + `new-tx/${txId}/${day().toISOString()}`)

	await wait(500)

	expect(addressTxEvent).toHaveBeenCalledTimes(1)
})

it('calls confirmations and newBlock event', async () => {
	jest.clearAllMocks()
	const blockHash = kuuid.id()

	const response = await axios.post(url + `new-block/${blockHash}/${day().toISOString()}`)

	expect(response.status).toBe(204)

	await wait(500)

	expect(confirmationsEvent).toHaveBeenCalled()
	expect(newBlockEvent).toHaveBeenCalled()
})