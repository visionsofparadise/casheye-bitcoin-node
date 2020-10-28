module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	verbose: true,
	rootDir: 'src/',
};

process.env.XLH_LOGS = 'true'
process.env.STAGE = 'test';
