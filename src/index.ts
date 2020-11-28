import { getApis } from './api'
import { btc } from './bitcoind'
import fs from 'fs'
import path from 'path'
import https from 'https'

const { internalApi, externalApi } = getApis(btc)

const internalPort = 3000
const externalPort = 4000

internalApi.listen(internalPort, () => console.log(`Internal API listening on port ${internalPort}`))

const httpsServer = https.createServer({
  key: fs.readFileSync(path.resolve(__dirname, `./privkey.pem`)),
  cert: fs.readFileSync(path.resolve(__dirname , `./fullchain.pem`)),
}, externalApi);

httpsServer.listen(externalPort, () => {
    console.log(`External API listening on port ${externalPort}`);
});