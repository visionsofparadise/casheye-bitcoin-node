import bitcoind from 'bitcoind'
import { ChildProcess } from 'child_process';
import { logger } from './helpers';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

let config = {
	testnet: process.env.NETWORK === 'testnet',
	regtest: process.env.NETWORK === 'regtest',
	prune: true,
	rpcuser,
	rpcpassword,
	rpcbind: '127.0.0.1',
	rpcallowip: '127.0.0.1',
	blocknotify: 'curl http://127.0.0.1:3000/block-notify/%s',
	walletnotify: 'curl http://127.0.0.1:3000/wallet-notify/%s',
};

export const startBTC = () => {
	bitcoind(config) as ChildProcess & { rpc: any };

	logger.info('BTC node online')

	return
}