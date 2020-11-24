import { CfnOutput, Construct, SecretValue, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { BlockDeviceVolume, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Port, UserData, Vpc } from '@aws-cdk/aws-ec2';
import { EventBus } from '@aws-cdk/aws-events';
import { createOutput } from 'xkore-lambda-helpers/dist/cdk/createOutput'
import {nanoid} from 'nanoid'
import { ARecord, PublicHostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { LoadBalancerTarget } from '@aws-cdk/aws-route53-targets';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { ApplicationLoadBalancer, ApplicationProtocol } from '@aws-cdk/aws-elasticloadbalancingv2';
import { IpTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';

const prodEC2Config = {
	storageSize: 400,
	instanceSize: InstanceSize.LARGE,
	instanceCount: 1
}

const testEC2Config = {
	storageSize: 20,
	instanceSize: InstanceSize.SMALL,
	instanceCount: 1
}

export class CasheyeAddressWatcherStage extends Stage {	
	public readonly loadBalancerUrl: CfnOutput;
	public readonly secret: CfnOutput;

		constructor(scope: Construct, id: string, props: StageProps & { STAGE: string }) {
		super(scope, id, props);

		const stack = new CasheyeAddressWatcherStack(this, 'stack', {
			STAGE: props.STAGE,
			env: {
				account: process.env.CDK_DEFAULT_ACCOUNT,
				region: 'us-east-1'
			}
		});

		this.loadBalancerUrl = stack.loadBalancerUrl
		this.secret = stack.secret
	}
}

export class CasheyeAddressWatcherStack extends Stack {
	public readonly loadBalancerUrl: CfnOutput;
	public readonly secret: CfnOutput;

	get availabilityZones(): string[] {
    return ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-east-1d', 'us-east-1e', 'us-east-1f'];
  }

	constructor(scope: Construct, id: string, props: StackProps & { STAGE: string }) {
		super(scope, id, props);

		const deploymentName = `${serviceName}-${props.STAGE}`;
		const isProd = (props.STAGE === 'prod')

		const vpc = new Vpc(this, 'VPC', {
			natGateways: 0,
			cidr: "10.0.0.0/16",
			maxAzs: 2
		});

		const loadBalancer = new ApplicationLoadBalancer(this, 'LB', {
			internetFacing: true,
			vpc,
			vpcSubnets: {
				subnets: vpc.publicSubnets
			}
		});

		loadBalancer.connections.allowToAnyIpv4(Port.tcp(80))

		const certificate = Certificate.fromCertificateArn(this, 'Certificate', SecretValue.secretsManager('DOMAIN_CERTIFICATE_ARN').toString());
		
		const listener = loadBalancer.addListener('Listener', {
			port: 443,
			protocol: ApplicationProtocol.HTTPS,
			certificates: [certificate]
		});

		const instances: Array<Instance> = []
		const config = isProd ? prodEC2Config : testEC2Config
		const secret = nanoid()
		const shebang = `#!/bin/bash

# installation
apt-get update -y
apt install nodejs npm -y

# set up project
git clone https://github.com/visionsofparadise/${serviceName}.git
cd ${serviceName}
export XLH_LOGS=${!isProd}
export STAGE=${props.STAGE}
export SECRET=${secret}
npm i
npm run compile
npm run test
npm run startd

iptables -A PREROUTING -t nat -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 4000`

		for (let i = 0; i < config.instanceCount; i++) {
			const nodeName = deploymentName + '-node-' + i
			
			const instance = new Instance(this, 'Instance', {
				instanceName: nodeName,
				vpc,
				vpcSubnets: {
					subnets: vpc.publicSubnets
				},
				instanceType: InstanceType.of(InstanceClass.T2, config.instanceSize),
				machineImage: MachineImage.genericLinux({
					'us-east-1': 'ami-0885b1f6bd170450c'
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
				})
			})

			instance.connections.allowFromAnyIpv4(Port.tcp(80))	
			instance.connections.allowFromAnyIpv4(Port.tcp(8333))
			EventBus.grantPutEvents(instance.grantPrincipal)

			instances.push(instance)
		}

		listener.addTargets('ApplicationFleet', {
			port: 80,
			targets: instances.map(instance => new IpTarget(instance.instancePublicIp)),
			healthCheck: {
				port: '80',
				enabled: true
			}
		});

		const lbHostName = deploymentName + '-lb'

		const hostedZone = PublicHostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
			zoneName: 'casheye.io',
			hostedZoneId: SecretValue.secretsManager('CASHEYE_HOSTED_ZONE_ID').toString()
		});

		new ARecord(this, 'ARecord', {
			zone: hostedZone,
			target: RecordTarget.fromAlias(new LoadBalancerTarget(loadBalancer)),
			recordName: lbHostName
		});

		this.loadBalancerUrl = createOutput(this, deploymentName, 'loadBalancerUrl', 'https://' + lbHostName + '.casheye.io/');
		this.secret = createOutput(this, deploymentName, 'secret', secret);
	}
}
