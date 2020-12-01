import Client from 'bitcoin-core';
import { isProd } from './helpers';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

export const rpc = new Client({ 
	network: isProd ? 'mainnet' : 'regtest',
	username: rpcuser,
	password: rpcpassword
 } as any);