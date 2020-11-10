import { CfnOutput, Construct, Fn, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { Rule } from '@aws-cdk/aws-events';
import { Code } from '@aws-cdk/aws-lambda';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import path from 'path';
import { masterFunction } from 'xkore-lambda-helpers/dist/cdk/masterFunction';
import { Peer, Port, SecurityGroup, Vpc } from '@aws-cdk/aws-ec2';
import { NetworkLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { ContainerImage } from '@aws-cdk/aws-ecs';
import { Repository } from '@aws-cdk/aws-ecr';
import { NetworkLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';
import { Table } from '@aws-cdk/aws-dynamodb';
import { RestApi, Cors, LambdaIntegration } from '@aws-cdk/aws-apigateway';

const createFunction = masterFunction({
	code: Code.fromAsset(path.join(__dirname, '../../build'))
});

export class CasheyeAddressWatcherStage extends Stage {	
	public readonly apiUrl?: CfnOutput;

		constructor(scope: Construct, id: string, props: StageProps & { STAGE: string; REPO_NAME: string }) {
		super(scope, id, props);

		const stack = new CasheyeAddressWatcherStack(this, 'stack', {
			STAGE: props.STAGE,
			REPO_NAME: props.REPO_NAME
		});

		this.apiUrl = stack.apiUrl
	}
}

export class CasheyeAddressWatcherStack extends Stack {
	public readonly apiUrl?: CfnOutput;

	constructor(scope: Construct, id: string, props: StackProps & { STAGE: string; REPO_NAME: string }) {
		super(scope, id, props);

		const deploymentName = `${serviceName}-${props.STAGE}`;
		const baseEnvironment = {
				STAGE: props.STAGE,
				XLH_LOGS: `${props.STAGE !== 'prod'}`
		}

		const repo = Repository.fromRepositoryName(this, 'ImageRepository', props.REPO_NAME)

		const vpc = new Vpc(this, 'VPC', {
			natGateways: 0,
			cidr: "10.0.0.0/16",
			maxAzs: 1
		});
		
		const securityGroup = new SecurityGroup(this, 'securityGroup', {
			vpc,
			allowAllOutbound: true,
			description: 'http and btc peers',
			securityGroupName: deploymentName + '-sg'
		})

		securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80))
		securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(8333))

		const networkLoadBalancer = new NetworkLoadBalancer(this, 'LB', {
			loadBalancerName: deploymentName + '-lb',
			vpc,
			internetFacing: false,
			vpcSubnets: {
				subnets: vpc.isolatedSubnets
			}
		});

		const loadBalancedFargateService = new NetworkLoadBalancedFargateService(this, 'fargateService', {
			memoryLimitMiB: 1024,
			assignPublicIp: true,
			vpc,
			desiredCount: 1,
			taskImageOptions: {
				image: ContainerImage.fromEcrRepository(repo, 'latest'),
				environment: baseEnvironment
			},
			 loadBalancer: networkLoadBalancer,
			 listenerPort: 80
		});

		loadBalancedFargateService.cluster.connections.addSecurityGroup(securityGroup)

		const environment = {
			...baseEnvironment,
			LOADBALANCER_URL: networkLoadBalancer.loadBalancerDnsName
		}

		const onAddressCreatedHandler = createFunction(this, 'onAddressCreated', { 
			environment,
			vpc,  
			allowAllOutbound: true, 
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

		if (props.STAGE !== 'prod') {
			const testRPCHandler = createFunction(this, 'testRPC', { 
				environment,
				vpc,  
				allowAllOutbound: true, 
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

			const testResultsHandler = createFunction(this, 'testResults', { environment });
			db.grantReadData(testResultsHandler.grantPrincipal);
			api.root.addResource('test-results').addMethod('GET', new LambdaIntegration(testResultsHandler));

			const testEventCaptureHandler = createFunction(this, 'testEventCapture', { 
				environment });
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
