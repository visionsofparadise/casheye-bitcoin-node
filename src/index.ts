import { getApis } from './api'
import { btc } from './bitcoind'
import fs from 'fs'
import https from 'https'

const { internalApi, externalApi } = getApis(btc)

const internalPort = 3000
const externalPort = 4000

internalApi.listen(internalPort, () => console.log(`Internal API listening on port ${internalPort}`))

const httpsServer = https.createServer({
  key: fs.readFileSync(__dirname + '/privkey.pem', 'utf8'),
  cert: fs.readFileSync(__dirname + '/fullchain.pem', 'utf8'),
}, externalApi);

httpsServer.listen(externalPort, () => {
    console.log(`External API listening on port ${externalPort}`);
});