
import cluster from 'cluster'
import { logger, wait } from './helpers'
import { rpc, startBitcoind } from './services/bitcoind/bitcoind'
import { webhookManager } from './services/webhookManager/webhookManager';
import { api } from './services/api/api'
import { redis } from './redis';

const jobs = ['bitcoind', 'webhookManager', 'api']

if (cluster.isMaster) {
	logger.info(`Master ${process.pid} is running`);

	const workerConfigs: Array<{ job: string; worker: cluster.Worker }> = []
	
	for (const job of jobs) {
		const env: any = {
			JOB: job,
			UV_THREADPOOL_SIZE: 4
		}

		if (job === 'api') env.UV_THREADPOOL_SIZE = 128

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

				const response = await rpc.generate(101)

				logger.info(response)
			}

			generator()
		}
	}
	if (job === 'webhookManager') redis.set('webhookManagerState', '1').then(() => webhookManager())
	if (job === 'api') api.listen(process.env.PORT || 4000, () => logger.info(`Server listening on port ${process.env.PORT || 4000}`))
}