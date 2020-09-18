const config = require('./config.json')
const cors = require('cors')
const express = require('express');
const Client = require('bitcoin-core');
const bodyParser = require('body-parser')
const app = express();

const rpc = new Client({
	network: config.network || 'regtest',
	username: config.user || 'test',
	password: config.pass || 'test'
})

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/bitcoind/:method', async function (req, res) {
	try {
		console.log(req)
		console.log(req.body)

		if (req.headers['authorization'] !== config.secret) return res.send('unauthorized')
	
		const data = await rpc[req.params.method](...req.body.params)
		console.log(data)
	
		res.send(data)
	} catch (err) {

		console.log(err)
		res.send(err)
	}
})
 
app.listen(3000);