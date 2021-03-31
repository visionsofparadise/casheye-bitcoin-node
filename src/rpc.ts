import Client from 'bitcoin-core';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

export const rpc = new Client({ 
	network: process.env.NETWORK!,
	port: process.env.NETWORK! === 'mainnet' ? 8333 : process.env.NETWORK! === 'testnet' ? 18333 : 18443,
	username: rpcuser,
	password: rpcpassword
 } as any);