import { CfnOutput, Construct, Fn, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { Rule } from '@aws-cdk/aws-events';
import { Code } from '@aws-cdk/aws-lambda';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import path from 'path';
import { masterFunction } from 'xkore-lambda-helpers/dist/cdk/masterFunction';
import { BlockDeviceVolume, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Port, UserData, Vpc } from '@aws-cdk/aws-ec2';
import { ApplicationLoadBalancer, ApplicationProtocol } from '@aws-cdk/aws-elasticloadbalancingv2';
import { InstanceTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import { Table } from '@aws-cdk/aws-dynamodb';
import { RestApi, Cors, LambdaIntegration } from '@aws-cdk/aws-apigateway';

const prodEC2Config = {
	storageSize: 400,
	instanceSize: InstanceSize.MEDIUM
}

const testEC2Config = {
	storageSize: 20,
	instanceSize: InstanceSize.SMALL
}

const createFunction = masterFunction({
	code: Code.fromAsset(path.join(__dirname, '../../build'))
});

export class CasheyeAddressWatcherStage extends Stage {	
	public readonly apiUrl?: CfnOutput;

		constructor(scope: Construct, id: string, props: StageProps & { STAGE: string }) {
		super(scope, id, props);

		const stack = new CasheyeAddressWatcherStack(this, 'stack', {
			STAGE: props.STAGE,
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: 'us-east-1'
			}
		});

		this.apiUrl = stack.apiUrl
	}
}

export class CasheyeAddressWatcherStack extends Stack {
	public readonly apiUrl?: CfnOutput;

	get availabilityZones(): string[] {
    return ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f'];
  }

	constructor(scope: Construct, id: string, props: StackProps & { STAGE: string }) {
		super(scope, id, props);

		const deploymentName = `${serviceName}-${props.STAGE}`;
		const baseEnvironment = {
				STAGE: props.STAGE,
				XLH_LOGS: `${props.STAGE !== 'prod'}`
		}

		const vpc = new Vpc(this, 'VPC', {
			natGateways: 0,
			cidr: "10.0.0.0/16",
			maxAzs: 2
		});

		const loadBalancer = new ApplicationLoadBalancer(this, 'LoadBalancer', {
			vpc,
			vpcSubnets: {
				subnets: vpc.isolatedSubnets
			}
		});

		const listener = loadBalancer.addListener(`Listener`, {
			port: 80,
			open: false
		})

		const environment = {
			...baseEnvironment,
			LOADBALANCER_URL: 'http://' + loadBalancer.loadBalancerDnsName + '/'
		}

		const instanceCount = 1
		const instances: Array<Instance> = []
		const config = props.STAGE === 'prod' ? prodEC2Config : testEC2Config
		const shebang = `#!/bin/bash

# install node
apt-get update -y
apt install nodejs npm -y

# set up project
git clone https://github.com/visionsofparadise/${serviceName}.git
cd ${serviceName}
XLH_LOGS=${environment.XLH_LOGS}
STAGE=${environment.STAGE}
LOADBALANCER_URL=${environment.LOADBALANCER_URL}
npm ci
npm run compile
npm run test
npm run start`

		for (let i = 0; i < instanceCount; i++) {
			const instance = new Instance(this, 'Instance', {
				instanceName: `${deploymentName}-node-${i}`,
				vpc,
				instanceType: InstanceType.of(InstanceClass.T2, config.instanceSize),
				machineImage: MachineImage.genericLinux({
					'us-east-1': 'ami-0885b1f6bd170450c'
				}),
				allowAllOutbound: true,
				vpcSubnets: {
					subnets: vpc.publicSubnets
				},
				userData: UserData.forLinux({
					shebang
				}),
				blockDevices: [
					{
						deviceName: '/dev/sda1',
						volume: BlockDeviceVolume.ebs(config.storageSize),
					},
				]
			})

			instance.connections.allowFromAnyIpv4(Port.tcp(8333))
			instance.connections.allowFrom(loadBalancer, Port.tcp(4000))

			instances.push(instance)
		}

		listener.addTargets('InstanceTargets', {
			port: 4000,
			protocol: ApplicationProtocol.HTTP,
			targets: instances.map(instance => new InstanceTarget(instance)),
			healthCheck: {
				enabled: true
			}
		})

		const onAddressCreatedHandler = createFunction(this, 'onAddressCreated', { 
			environment,
			vpc,
			vpcSubnets: {
				subnets: vpc.isolatedSubnets
		} });
		new Rule(this, 'onAddressCreatedRule', {
			eventPattern: {
				source: [`casheye-${props.STAGE}`],
				detailType: ['addressCreated']
			},
			targets: [new LambdaFunction(onAddressCreatedHandler)]
		});

		loadBalancer.connections.allowFrom(onAddressCreatedHandler, Port.tcp(80))
		onAddressCreatedHandler.connections.allowTo(loadBalancer, Port.tcp(80))

		if (props.STAGE !== 'prod') {
			const testRPCHandler = createFunction(this, 'testRPC', { 
				environment,
				vpc, 
				vpcSubnets: {
					subnets: vpc.isolatedSubnets
			} });
			new Rule(this, 'testRPCRule', {
				eventPattern: {
					source: [`casheye-${props.STAGE}`],
					detailType: ['rpcCommand']
				},
				targets: [new LambdaFunction(testRPCHandler)]
			});

			loadBalancer.connections.allowFrom(testRPCHandler, Port.tcp(80))
			testRPCHandler.connections.allowTo(loadBalancer, Port.tcp(80))

			const db = Table.fromTableArn(this, 'dynamoDB', Fn.importValue(`casheye-dynamodb-${props.STAGE}-arn`));

			const api = new RestApi(this, 'restApi', {
				restApiName: deploymentName + '-api',
				description: deploymentName,
				defaultCorsPreflightOptions: {
					allowOrigins: Cors.ALL_ORIGINS
				}
			});

			this.apiUrl = new CfnOutput(this, 'apiUrlOutput', {
				value: api.url,
				exportName: deploymentName + '-apiUrl'
			});

			const environment2 = {
				...environment,
				DYNAMODB_TABLE: db.tableName
			}

			const testResultsHandler = createFunction(this, 'testResults', { environment: environment2 });
			db.grantReadData(testResultsHandler.grantPrincipal);
			api.root.addResource('test-results').addMethod('GET', new LambdaIntegration(testResultsHandler));

			const testEventCaptureHandler = createFunction(this, 'testEventCapture', { 
				environment: environment2 });
			db.grantWriteData(testEventCaptureHandler.grantPrincipal);
			new Rule(this, 'testEventCaptureRule', {
				eventPattern: {
					source: [`casheye-${props.STAGE}`],
					detailType: ['btcTxDetected', 'btcAddressWatching', 'btcAddressExpired', 'btcAddressUsed', 'btcConfirmation']
				},
				targets: [new LambdaFunction(testEventCaptureHandler)]
			});
		}
	}
}
