import { getApis } from './api'
import { btc } from './bitcoind'
import dotenv from 'dotenv'
dotenv.config()

const { internalApi, externalApi } = getApis(btc, process.env.INSTANCE_SECRET!)

const internalPort = 3000
const externalPort = 4000

internalApi.listen(internalPort, () => console.log(`Internal API listening on port ${internalPort}`))
externalApi.listen(externalPort, () => console.log(`External API listening on port ${externalPort}`))