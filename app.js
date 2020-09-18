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
	if (req.headers['authorization'] !== config.secret) return res.send('unauthorized')
	if (req.ip !== config.ip) return res.send('unauthorized')

  next()
})

 
bitcoinapi.setWalletDetails(wallet);
bitcoinapi.setAccess('default-safe');

app.use('/bitcoind', bitcoinapi.app);
 
app.listen(3000);