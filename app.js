const bitcoinapi = require('bitcoin-node-api');
const config = require('./config.json')
const express = require('express');
const app = express();
 
const wallet = {
  host: 'localhost',
  port: config.port,
  user: config.user,
  pass: config.pass
};

app.use('/bitcoind', function (req, res, next) {
	if (req.headers['authorization'] !== secret) throw res.statusCode('401')
	if (req.ip !== config.ip) throw res.statusCode('401')

  next()
})

 
bitcoinapi.setWalletDetails(wallet);
bitcoinapi.setAccess('default-safe');

app.use('/bitcoind', bitcoinapi.app);
 
app.listen(3000);