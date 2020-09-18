const config = require('./config.json')
const cors = require('cors')
const express = require('express');
const Client = require('bitcoin-core');
const app = express();

const rpc = new Client({
	network: config.network,
	username: config.user,
	password: config.pass
})

app.use(cors())
app.post('/bitcoind', async function (req, res) {
	try {
		console.log(req)

		if (req.headers['authorization'] !== config.secret) return res.send('unauthorized')
	
		const data = await rpc.command(req.body.command)
	
		res.send(data)
	} catch (err) {

		console.log(err)
		throw err
	}
})
 
app.listen(3000);