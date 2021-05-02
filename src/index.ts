
import cluster from 'cluster'
import { logger, wait } from './helpers'
import { rpc, startBitcoind } from './services/bitcoind/bitcoind'
import { webhookManager } from './services/webhookManager/webhookManager';
import { api } from './services/api/externalApi'
import { cloudPut } from './services/cloudLogger/cloudPut'
import { redis } from './redis';
import reverse from 'lodash/reverse';
import pick from 'lodash/pick';
import { addressTxSubscription } from './services/eventsManager/addressTxEvent';
import { confirmationsSubscription } from './services/eventsManager/confirmationsEvent';
import { newBlockSubscription } from './services/eventsManager/newBlockEvent';

const jobs = ['bitcoind', 'cloudLogger', 'webhookManager', 'api', 'addressTxSubscription', 'confirmationsSubscription', 'newBlockSubscription']

if (cluster.isMaster) {
	logger.info(`Master ${process.pid} is running`)

	const workerConfigs: Array<{ job: string; worker: cluster.Worker }> = []

	for (const job of jobs) {
		const env: any = {
			...pick(process.env, [
				"NODE_ENV", 
				"NODE_INDEX", 
				"STAGE", 
				"NETWORK", 
				"WEBSOCKET_URL", 
				"SET_QUEUE_URL", 
				"UNSET_QUEUE_URL", 
				"ERROR_QUEUE_URL", 
				"LOG_GROUP_NAME", 
				"DYNAMODB_TABLE", 
				"RPC_USER", 
				"RPC_PASSWORD"
			]),
			JOB: job
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
				logger.info(`worker ${job} died`)
				
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
	
	if (job === 'api') {
		const port = 4000
		api.listen(port, async () => logger.info(`Server listening on port ${port}`))
	}

	const delay = (fn: any, s: number) => 
		setTimeout(() => {
			logger.info(job + ' listening...')
			fn()
		}, s * 1000)

	if (job === 'addressTxSubscription') delay(addressTxSubscription, 10)
	if (job === 'confirmationsSubscription') delay(confirmationsSubscription, 10)
	if (job === 'newBlockSubscription') delay(newBlockSubscription, 10)
}