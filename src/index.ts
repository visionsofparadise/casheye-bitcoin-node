import { getApis } from './api'
import { btc } from './bitcoind'

const { internalApi, externalApi } = getApis(btc)

const internalPort = 3000
const externalPort = 4000

internalApi.listen(internalPort, () => console.log(`Internal API listening on port ${internalPort}`))

const server = externalApi.listen(externalPort, () => console.log(`External API listening on port ${externalPort}`))

server.setTimeout(5 * 60 * 1000)