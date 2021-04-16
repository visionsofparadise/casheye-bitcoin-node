import spawnLogger from 'envlog';

export const isProd = process.env.STAGE === 'prod';
export const Source = 'casheye-' + process.env.STAGE

export const logger = spawnLogger({
	envKey: 'STAGE',
	offValue: 'prod'
});

export type Network = 'mainnet' | 'testnet' | 'regtest'

export type Currency = 'BTC' | 'BTC-testnet'

export const networkCurrencies = {
	mainnet: ['BTC'],
	testnet: ['BTC-testnet'],
	regtest: ['BTC', 'BTC-testnet']
}

export const wait = async (ms: number) =>
	new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});