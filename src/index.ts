import { getApis } from './api'
import { btc } from './bitcoind'
import https from 'https';
const fs = require('fs');

const { internalApi, externalApi } = getApis(btc)

internalApi.listen(3000, () => console.log('Internal API listening on port 3000'))

const httpsServer = https.createServer({
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.INSTANCE_DNS_NAME}/privkey.pem`),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.INSTANCE_DNS_NAME}/fullchain.pem`),
}, externalApi);

httpsServer.listen(4000, () => {
    console.log('External HTTPS API listening on port 4000');
});