
import cluster from 'cluster'
import { logger, wait } from './helpers'
import { rpc, startBitcoind } from './services/bitcoind/bitcoind'
import { webhookManager } from './services/webhookManager/webhookManager';
import { api as internalApi } from './services/api/internalApi'
import { api as externalApi } from './services/api/externalApi'
import { cloudPut } from './services/cloudLogger/cloudPut'
import { redis } from './redis';
import reverse from 'lodash/reverse';

const jobs = ['bitcoind', 'cloudLogger', 'webhookManager', 'internalApi', 'externalApi']

if (cluster.isMaster) {
	logger.info(`Master ${process.pid} is running`);

	const workerConfigs: Array<{ job: string; worker: cluster.Worker }> = []
	
	for (const job of jobs) {
		const env: any = {
			JOB: job,
			UV_THREADPOOL_SIZE: 4
		}

		if (job === 'internalApi') env.UV_THREADPOOL_SIZE = 128

		const worker = cluster.fork(env);

		workerConfigs.push({
			job, worker
		})
	}

	for (const workerConfig of workerConfigs) {
		const { job, worker } = workerConfig

		worker.on('exit', (code) => {
			if (code !== 0) {
				logger.info(`worker ${job} died`);
			
				cluster.fork({
					JOB: job
				});
			}
		});
	}
}

if (cluster.isWorker) {
	logger.info(`Worker ${process.pid} started`);

	const job = process.env.JOB
	
	if (job === 'bitcoind') {
		startBitcoind()

		if (process.env.NETWORK === 'regtest') {
			const generator = async () => {
				await wait(5 * 1000)

				const response = await rpc.generate(101) as string[]

				await redis.lpush('blockHashCache', ...reverse(response))

				logger.info(response)
			}

			generator()
		}
	}

	if (job === 'cloudLogger') cloudPut()

	if (job === 'webhookManager') redis.set('webhookManagerState', '1').then(() => webhookManager())

	if (job === 'internalApi') {
		const asyncFn = async () => {
			await wait(10 * 1000)

			const internalPort = 3000
			internalApi.listen(internalPort, () => logger.info(`Server listening on port ${internalPort}`))
		}

		asyncFn
	}
	
	if (job === 'externalApi') {
		const externalPort = 4000
		externalApi.listen(externalPort, () => logger.info(`Server listening on port ${externalPort}`))
	}
}