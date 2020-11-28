import bitcoind from 'bitcoind'
import { ChildProcess } from 'child_process';
import { isProd } from './helpers';

const prodConfig = {
	prune: true,
	rpcbind: '127.0.0.1',
	rpcallowip: '127.0.0.1',
	blocknotify: 'curl http://127.0.0.1:3000/block-notify/%s',
	walletnotify: 'curl http://127.0.0.1:3000/wallet-notify/%s',
};

const testConfig = {
	regtest: true,
	prune: true,
	rpcbind: '127.0.0.1',
	rpcallowip: '127.0.0.1',
	blocknotify: 'curl http://127.0.0.1:3000/block-notify/%s',
	walletnotify: 'curl http://127.0.0.1:3000/wallet-notify/%s',
};

export const btc = bitcoind(isProd ? prodConfig : testConfig) as ChildProcess & { rpc: any };