import { CfnOutput, Construct, Duration, Fn, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { BlockDeviceVolume, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Port, UserData, Vpc } from '@aws-cdk/aws-ec2';
import { masterOutput } from 'xkore-lambda-helpers/dist/cdk/createOutput'
import { EventResource } from 'xkore-lambda-helpers/dist/cdk/EventResource'
import { masterLambda } from 'xkore-lambda-helpers/dist/cdk/masterLambda'
import { EventBus } from '@aws-cdk/aws-events';
import { Runtime, Code } from '@aws-cdk/aws-lambda';
import { Queue } from '@aws-cdk/aws-sqs';
import { webhookSetEvent, webhookUnsetEvent } from '../services/webhookManager/events';
import { onSetWebhookHandler } from '../handlers/onSetWebhook';
import { onUnsetWebhookHandler } from '../handlers/onUnsetWebhook';
import { DocumentationItems, Documented } from 'xkore-lambda-helpers/dist/cdk/DocumentationItems';
import path from 'path'
import { Network, networkCurrencies } from '../helpers';
import { Effect, PolicyStatement } from '@aws-cdk/aws-iam';
import { RestApi, Cors, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2';
import { LambdaWebSocketIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs';
import { Table } from '@aws-cdk/aws-dynamodb';

const prodEC2Config = {
	storageSize: 400,
	instanceType: InstanceType.of(InstanceClass.A1, InstanceSize.XLARGE),
	instanceAmi: "ami-0b75998a97c952252",
}

const testEC2Config = {
	storageSize: 20,
	instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.SMALL),
	instanceAmi: "ami-09e67e426f25ce0d7",
}

export class CasheyeBitcoinNodeStage extends Stage {	
	public readonly instanceUrl?: CfnOutput;
	public readonly testUrl?: CfnOutput;
	public readonly websocketTestUrl?: CfnOutput;

		constructor(scope: Construct, id: string, props: StageProps & { STAGE: string; NETWORK: Network }) {
		super(scope, id, props);

		const stack = new CasheyeBitcoinNodeStack(this, 'stack', {
			STAGE: props.STAGE,
			NETWORK: props.NETWORK,
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: 'us-east-1'
			}
		});

		this.instanceUrl = stack.instanceUrl
		this.testUrl = stack.testUrl
		this.websocketTestUrl = stack.websocketTestUrl
	}
}

const { createLambda, initializeRuleLambda } = masterLambda({
	runtime: Runtime.NODEJS_12_X,
	code: Code.fromAsset(path.join(__dirname, '../../build')),
})

export class CasheyeBitcoinNodeStack extends Stack {
	public readonly instanceUrl?: CfnOutput;
	public readonly testUrl?: CfnOutput;
	public readonly websocketTestUrl?: CfnOutput;

	get availabilityZones(): string[] {
    return ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f'];
	}
	
	constructor(scope: Construct, id: string, props: StackProps & { STAGE: string; NETWORK: Network }) {
		super(scope, id, props);
		
		const deploymentName = `${serviceName}-${props.NETWORK}-${props.STAGE}`;
		const isProd = (props.STAGE === 'prod')

		const createOutput = masterOutput(this, deploymentName)

		const documented: Array<Documented> = [
			new EventResource(this, webhookSetEvent), 
			new EventResource(this, webhookUnsetEvent)
		]
		
		const vpc = new Vpc(this, 'VPC', {
			natGateways: 0,
			cidr: "10.0.0.0/16",
			maxAzs: 2
		});

		let websocketTestUrl: string | undefined

		if (props.STAGE !== 'prod') {
			const testWebsocketHandler = createLambda(this, 'testWebsocketApi', {
				environment: {
					STAGE: props.STAGE
				}
			});

			const integration = new LambdaWebSocketIntegration({
				handler: testWebsocketHandler
			});
	
			const websocketApi = new WebSocketApi(this, `api`, {
				connectRouteOptions: {
					integration
				},
				disconnectRouteOptions: {
					integration
				},
				defaultRouteOptions: {
					integration
				}
			});

			websocketApi.addRoute('message', {
				integration
			})
	
			new WebSocketStage(this, `stage`, {
				webSocketApi: websocketApi,
				stageName: props.STAGE,
				autoDeploy: true
			});

			websocketTestUrl = websocketApi.apiEndpoint + '/test'
			this.websocketTestUrl = createOutput('websocketTestUrl', websocketTestUrl);
		}

		const setQueue = new Queue(this, 'SetQueue', {
			visibilityTimeout: Duration.seconds(3)
		});

		createOutput('setQueueUrl', setQueue.queueUrl)

		const errorQueue = Queue.fromQueueArn(this, 'ErrorQueue', Fn.importValue(`casheye-webhook-${props.STAGE}-errorQueueArn`))

		const unsetQueues: Queue[] = []

		const db = Table.fromTableArn(this, 'DynamoDB', Fn.importValue(`casheye-dynamodb-test-arn`));

		const instanceCount = 1
		const config = isProd ? prodEC2Config : testEC2Config
		const instances: Instance[] = []	

		for (let i = 0; i < instanceCount; i++) {
			const unsetQueue = new Queue(this, `UnsetQueue${i}`, {
				visibilityTimeout: Duration.seconds(3)
			});

			createOutput(`unsetQueueUrl${i}`, unsetQueue.queueUrl)

			unsetQueues.push(unsetQueue)

			const logGroup = new LogGroup(this, `LogGroup${i}`, {
				retention: RetentionDays.ONE_WEEK
			});

			const nodeName = deploymentName + `-node-${i}`
			const instanceEnv = `NODE_ENV=production NODE_INDEX=${i} STAGE=${props.STAGE} NETWORK=${props.NETWORK} WEBSOCKET_URL=${websocketTestUrl || Fn.importValue(`casheye-webhook-${props.STAGE}-websocketUrl`)} SET_QUEUE_URL=${setQueue.queueUrl} UNSET_QUEUE_URL=${unsetQueue.queueUrl} ERROR_QUEUE_URL=${errorQueue.queueUrl} LOG_GROUP_NAME=${logGroup.logGroupName} DYNAMODB_TABLE=${db.tableName} RPC_USER=$RPC_USER RPC_PASSWORD=$RPC_PASSWORD`

			const shebang = `#!/bin/bash
sudo add-apt-repository ppa:chris-lea/redis-server
sudo apt-get update -y
sudo apt install nodejs npm -y
sudo apt-get install redis-server -y
sudo systemctl enable redis-server
git clone https://github.com/visionsofparadise/${serviceName}.git
cd ${serviceName}
npm i
npm i -g pm2
npm run compile
RPC_USER=$(openssl rand -hex 12)
RPC_PASSWORD=$(openssl rand -hex 12)
${instanceEnv} pm2 start dist/index.js
env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save`
	
			const instance = new Instance(this, `Instance${i}`, {
				instanceName: nodeName,
				vpc,
				vpcSubnets: {
					subnets: vpc.publicSubnets
				},
				instanceType: config.instanceType,
				machineImage: MachineImage.genericLinux({
					'us-east-1': config.instanceAmi
				}),
				allowAllOutbound: true,
				blockDevices: [
					{
						deviceName: '/dev/sda1',
						volume: BlockDeviceVolume.ebs(config.storageSize),
					},
				],
				userData: UserData.forLinux({
					shebang
				}),
				userDataCausesReplacement: true
			})

			instance.addToRolePolicy(new PolicyStatement({
				actions: ['execute-api:*'],
				resources: [`arn:aws:execute-api:*:*:**/@connections/*`],
				effect: Effect.ALLOW
			}))
	
			instance.connections.allowFromAnyIpv4(Port.tcp(4000))
			instance.connections.allowFromAnyIpv4(Port.tcp(8333))
			EventBus.grantAllPutEvents(instance.grantPrincipal)
			setQueue.grantConsumeMessages(instance.grantPrincipal)
			setQueue.grantSendMessages(instance.grantPrincipal)
			unsetQueue.grantConsumeMessages(instance.grantPrincipal)
			errorQueue.grantSendMessages(instance.grantPrincipal)
			logGroup.grantWrite(instance.grantPrincipal)
			db.grantReadWriteData(instance.grantPrincipal)

			instances.push(instance)
		}

		const createRuleLambda = initializeRuleLambda('casheye-' + props.STAGE)

		const onSetWebhook = createRuleLambda(this, 'onSetWebhook', {
			RuleLambdaHandler: onSetWebhookHandler,
			eventPattern: {
				detail: {
					currency: networkCurrencies[props.NETWORK]
				}
			},
			environment: {
				STAGE: props.STAGE,
				SET_QUEUE_URL: setQueue.queueUrl
			}
		})

		setQueue.grantSendMessages(onSetWebhook)
		documented.push(onSetWebhook)

		const unsetQueueUrls = unsetQueues.map(queue => queue.queueUrl).join(',')

		const onUnsetWebhook = createRuleLambda(this, 'onUnsetWebhook', {
			RuleLambdaHandler: onUnsetWebhookHandler,
			eventPattern: {
				detail: {
					currency: networkCurrencies[props.NETWORK]
				}
			},
			environment: {
				STAGE: props.STAGE,
				UNSET_QUEUE_URLS: unsetQueueUrls
			}
		})

		for (const queue of unsetQueues) {
			queue.grantSendMessages(onUnsetWebhook)
		}
		documented.push(onUnsetWebhook)

		if (props.STAGE !== 'prod') {
			const instanceUrl = 'http://' + instances[0].instancePublicDnsName + ':4000/'
			this.instanceUrl = createOutput('instanceUrl', instanceUrl);

			const api = new RestApi(this, 'testApi', {
				restApiName: deploymentName + '-testApi',
				description: deploymentName,
				defaultCorsPreflightOptions: {
					allowOrigins: Cors.ALL_ORIGINS
				}
			});
			
			const webhookTestResource = api.root.addResource('test');

			const testEndpoint = createLambda(this, 'testEndpoint', {
				environment: {
					INSTANCE_URL: instanceUrl,
					DYNAMODB_TABLE: db.tableName
				}
			});
			db.grantWriteData(testEndpoint.grantPrincipal)

			webhookTestResource.addMethod('POST', new LambdaIntegration(testEndpoint))

			this.testUrl = createOutput('testUrl', api.url);
		}

		new DocumentationItems(this, 'DocumentationItems', {
			tableArn: Fn.importValue(`casheye-dynamodb-${props.STAGE}-arn`),
			service: serviceName,
			groups: [
				{
					name: 'BitcoinNode',
					items: documented
				}
			]
		});
	}
}