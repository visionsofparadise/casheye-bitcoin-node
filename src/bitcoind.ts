import bitcoind from 'bitcoind';

const prodConfig = {};

const testConfig = {};

const isProd = process.env.STAGE === 'prod';

export const btc = bitcoind(isProd ? prodConfig : testConfig);
