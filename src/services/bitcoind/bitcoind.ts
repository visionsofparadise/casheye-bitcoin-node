import bitcoind from 'bitcoind'
import { ChildProcess } from 'child_process';
import { logger } from '../../helpers';
import Client from 'bitcoin-core';
 
const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

let config: any = {
	prune: true,
	testnet: process.env.NETWORK === 'testnet',
	regtest: process.env.NETWORK === 'regtest',
	blocknotify: 'redis-cli PUBLISH new-block "%s#$(date -Ins)"',
	walletnotify: 'redis-cli PUBLISH new-tx "%s#$(date -Ins)"',
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