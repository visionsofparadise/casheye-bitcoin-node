import Client from 'bitcoin-core';

const rpcuser = process.env.RPC_USER || 'test';
const rpcpassword = process.env.RPC_PASSWORD || 'test';

export const rpc = new Client({ 
	network: process.env.NETWORK!,
	username: rpcuser,
	password: rpcpassword
 } as any);