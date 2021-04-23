import bitcoind from 'bitcoind'
import { ChildProcess } from 'child_process';
import { logger } from '../../helpers';
import Client from 'bitcoin-core';
import Redis from 'ioredis'

new Redis('127.0.0.1')
 
const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

let config: any = {
	testnet: process.env.NETWORK === 'testnet',
	regtest: process.env.NETWORK === 'regtest',
	blocknotify: `curl -d '{"timestamp": "$(date -Ins)"}' -X POST "http://localhost:4000/new-block/%s"`,
	walletnotify: `curl -d '{"timestamp": "$(date -Ins)"}' -X POST "http://localhost:4000/new-tx/%s"`,
};

if (process.env.STAGE !== 'prod') {
	config.rpcuser = rpcuser
	config.rpcpassword = rpcpassword
	config.rpcbind = "127.0.0.1"
	config.rpcallowip = "127.0.0.1"
}

export const rpc = new Client({ 
	network: process.env.NETWORK!,
	username: rpcuser,
	password: rpcpassword
 } as any);

export const startBitcoind = () => {
	try {
		logger.info({ config })

		bitcoind(config) as ChildProcess & { rpc: any };

		logger.info('BTC node online')
	} catch (error) {
		logger.error(error)

		throw error
	}

	return
}