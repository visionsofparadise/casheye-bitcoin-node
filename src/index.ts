import { getApis } from './api'
import { btc } from './bitcoind'
import https from 'https';
import fs from 'fs';
import path from 'path'

const { internalApi, externalApi } = getApis(btc)

internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))

const httpsServer = https.createServer({
  key: fs.readFileSync(path.resolve(__dirname, `../privkey.pem`)),
  cert: fs.readFileSync(path.resolve(__dirname , `../fullchain.pem`)),
}, externalApi);

httpsServer.listen(4000, () => {
    console.log('External HTTPS API listening on port 4000');
});