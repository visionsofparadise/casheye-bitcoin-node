import { getApis } from './api'
import { btc } from './bitcoind'

const { internalApi, externalApi } = getApis(btc)

internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))
externalApi.listen(4000, () => console.log('External API listening on port 4000'))