
import { getApis } from './api'
import { btc } from './bitcoind'
import { getWatcher } from './addressWatcher'

const { internalApi, externalApi } = getApis(btc)

const internalPort = 3000
const externalPort = 4000

internalApi.listen(internalPort, () => console.log(`Internal API listening on port ${internalPort}`))
externalApi.listen(externalPort, () => console.log(`External API listening on port ${externalPort}`))

const watcher = getWatcher(btc)
watcher.watch()