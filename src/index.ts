
import cluster from 'cluster'
import { wait } from './helpers'
import { rpc, startBitcoind } from './services/bitcoind/bitcoind'
import { webhookManager } from './services/webhookManager/webhookManager';
import { api as internalApi } from './services/api/internalApi'
import { api as externalApi } from './services/api/externalApi'
import { cloudPut } from './services/cloudLogger/cloudPut'
import { redis } from './redis';
import reverse from 'lodash/reverse';
import { cloudLog } from './services/cloudLogger/cloudLog';
import pick from 'lodash/pick';

const jobs = ['bitcoind', 'cloudLogger', 'webhookManager', 'internalApi', 'externalApi']

if (cluster.isMaster) {
	cloudLog(`Master ${process.pid} is running`).then(() => {
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
					cloudLog(`worker ${job} died`).then(() => {
						cluster.fork({
							JOB: job
						});
					});
				}
			});
		}
	});
}

if (cluster.isWorker) {
	cloudLog(`Worker ${process.pid} started`);

	const job = process.env.JOB
	
	if (job === 'bitcoind') {
		startBitcoind()

		if (process.env.NETWORK === 'regtest') {
			const generator = async () => {
				await wait(5 * 1000)

				const response = await rpc.generate(101) as string[]

				await redis.lpush('blockHashCache', ...reverse(response))

				await cloudLog(response)
			}

			generator()
		}
	}

	if (job === 'cloudLogger') cloudPut()

	if (job === 'webhookManager') redis.set('webhookManagerState', '1').then(() => webhookManager())

	if (job === 'internalApi') {
		setTimeout(() => {
			const internalPort = 3000
			internalApi.listen(internalPort, async () => cloudLog(`Server listening on port ${internalPort}`))
		}, 15 * 1000)
	}
	
	if (job === 'externalApi') {
		const externalPort = 4000
		externalApi.listen(externalPort, async () => cloudLog(`Server listening on port ${externalPort}`))
	}
}