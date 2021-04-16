
import cluster from 'cluster'
import { logger } from './helpers'
import { startBitcoind } from './services/bitcoind/bitcoind'
import { webhookManager } from './services/webhookManager/webhookManager';
import { api } from './services/api/api'
import { addressTxSubscriber } from './services/eventsManager/addressTxEvent'
import { confirmationsSubscriber } from './services/eventsManager/confirmationsEvent'
import { newBlockSubscriber } from './services/eventsManager/newBlockEvent'

const jobs = ['bitcoind', 'webhookManager', 'api', 'addressTx', 'confirmations', 'newBlock']

if (cluster.isMaster) {
	logger.info(`Master ${process.pid} is running`);

	const workerConfigs: Array<{ job: string; worker: cluster.Worker }> = []
	
	for (const job of jobs) {
		const worker = cluster.fork({
			JOB: job
		});

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
	
	if (job === 'bitcoind') startBitcoind()
	if (job === 'webhookManager') webhookManager()
	if (job === 'api') api.listen(process.env.PORT || 4000, () => console.log(`Server listening on port ${process.env.PORT || 4000}`))

	if (job === 'addressTx') addressTxSubscriber()
	if (job === 'confirmations') confirmationsSubscriber()
	if (job === 'newBlock') newBlockSubscriber()
}