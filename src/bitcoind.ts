import bitcoind from 'bitcoind'
import { ChildProcess } from 'child_process';
import { isProd, logger } from './helpers';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

const prodConfig = {
	prune: true,
	rpcuser,
	rpcpassword,
	rpcbind: '127.0.0.1',
	rpcallowip: '127.0.0.1',
	blocknotify: 'curl http://127.0.0.1:3000/block-notify/%s',
	walletnotify: 'curl http://127.0.0.1:3000/wallet-notify/%s',
};

const testConfig = {
	regtest: true,
	prune: true,
	rpcuser,
	rpcpassword,
	rpcbind: '127.0.0.1',
	rpcallowip: '127.0.0.1',
	blocknotify: 'curl http://127.0.0.1:3000/block-notify/%s',
	walletnotify: 'curl http://127.0.0.1:3000/wallet-notify/%s',
};

export const startBTC = () => {
	bitcoind(isProd ? prodConfig : testConfig) as ChildProcess & { rpc: any };

	logger.info('BTC node online')
}