import { Construct, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { Rule } from '@aws-cdk/aws-events';
import { Code } from '@aws-cdk/aws-lambda';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import path from 'path';
import { masterFunction } from 'xkore-lambda-helpers/dist/cdk/masterFunction';
import { Port, Vpc } from '@aws-cdk/aws-ec2';
import { NetworkLoadBalancedFargateService } from '@aws-cdk/aws-ecs-patterns';
import { ContainerImage } from '@aws-cdk/aws-ecs';
import { Repository } from '@aws-cdk/aws-ecr';
import { NetworkLoadBalancer } from '@aws-cdk/aws-elasticloadbalancingv2';

const createFunction = masterFunction({
	code: Code.fromAsset(path.join(__dirname, '../../build'))
});

export class CasheyeAddressWatcherStage extends Stage {	
		constructor(scope: Construct, id: string, props: StageProps & { STAGE: string; REPO_NAME: string }) {
		super(scope, id, props);

		new CasheyeAddressWatcherStack(this, 'stack', {
			STAGE: props.STAGE,
			REPO_NAME: props.REPO_NAME
		});
	}
}

export class CasheyeAddressWatcherStack extends Stack {
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

		loadBalancedFargateService.cluster.connections.allowFromAnyIpv4(Port.tcp(8333), 'peering')
		loadBalancedFargateService.cluster.connections.allowInternally(Port.tcp(80), 'http')

		const environment = {
			...baseEnvironment,
			LOADBALANCER_URL: networkLoadBalancer.loadBalancerDnsName
		}

		const onAddressCreatedHandler = createFunction(this, 'onAddressCreated', { environment, vpcSubnets: {
			subnets: vpc.isolatedSubnets
		} });
		new Rule(this, 'onAddressCreatedRule', {
			eventPattern: {
				source: [`casheye-${props.STAGE}`],
				detailType: ['addressCreated']
			},
			targets: [new LambdaFunction(onAddressCreatedHandler)]
		});

		onAddressCreatedHandler.connections.allowToAnyIpv4(Port.tcp(80))
	}
}
