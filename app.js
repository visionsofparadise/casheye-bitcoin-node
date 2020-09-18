const config = require('./config.json')
const express = require('express');
const app = express();

const rpc = new RpcClient({
	network: config.network,
	username: config.user,
	password: config.pass
})

app.post('/bitcoind', async function (req, res) {
	if (req.headers['authorization'] !== config.secret) return res.send('unauthorized')

	const data = await rpc.command(req.body.command)

  res.send(data)
})
 
app.listen(3000);