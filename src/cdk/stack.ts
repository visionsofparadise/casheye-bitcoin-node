import { CfnOutput, Construct, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { BlockDeviceVolume, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Port, UserData, Vpc } from '@aws-cdk/aws-ec2';
import { EventBus } from '@aws-cdk/aws-events';
import { createOutput } from 'xkore-lambda-helpers/dist/cdk/createOutput'
import {nanoid} from 'nanoid'

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
	public readonly instanceUrl: CfnOutput;
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

		this.instanceUrl = stack.instanceUrl
		this.secret = stack.secret
	}
}

export class CasheyeAddressWatcherStack extends Stack {
	public readonly instanceUrl: CfnOutput;
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

		const config = isProd ? prodEC2Config : testEC2Config
		const shebang = `#!/bin/bash

# installation
apt-get update -y
apt-get install software-properties-common -y
add-apt-repository universe -y
add-apt-repository ppa:certbot/certbot -y
apt-get update -y
apt install nodejs npm -y
apt-get install certbot -y

# ssl certificate
INSTANCE_DNS_NAME=$(curl -s http://169.254.169.254/latest/meta-data/public-hostname)
certbot certonly --standalone -w "/var/www/$INSTANCE_DNS_NAME" -d $INSTANCE_DNS_NAME

# set up project
git clone https://github.com/visionsofparadise/${serviceName}.git
cd ${serviceName}
XLH_LOGS=${!isProd}
STAGE=${props.STAGE}
npm i
npm run compile
npm run test
npm run startd

iptables -A PREROUTING -t nat -i eth0 -p tcp --dport 443 -j REDIRECT --to-port 4000`

		const instance = new Instance(this, 'Instance', {
			instanceName: `${deploymentName}-node`,
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

		instance.connections.allowFromAnyIpv4(Port.tcp(8333))
		instance.connections.allowFromAnyIpv4(Port.tcp(443))

		EventBus.grantPutEvents(instance.grantPrincipal)

		this.instanceUrl = createOutput(this, deploymentName, 'instanceUrl', 'https://' + instance.instancePublicDnsName + '/');
		this.secret = createOutput(this, deploymentName, 'secret', nanoid());
	}
}
