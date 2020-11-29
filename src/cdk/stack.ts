import { CfnOutput, Construct, SecretValue, Stack, StackProps,  Stage, StageProps } from '@aws-cdk/core';
import { serviceName } from './pipeline';
import { BlockDeviceVolume, Instance, InstanceClass, InstanceSize, InstanceType, MachineImage, Port, UserData, Vpc } from '@aws-cdk/aws-ec2';
import { createOutput } from 'xkore-lambda-helpers/dist/cdk/createOutput'
import {nanoid, customAlphabet, urlAlphabet } from 'nanoid'
import { EventBus } from '@aws-cdk/aws-events';
import { ARecord, PublicHostedZone, RecordTarget } from '@aws-cdk/aws-route53';

const prodEC2Config = {
	storageSize: 400,
	instanceSize: InstanceSize.LARGE
}

const testEC2Config = {
	storageSize: 20,
	instanceSize: InstanceSize.SMALL
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
		const secret = nanoid()		
		const nodeName = deploymentName + '-node-' + customAlphabet(urlAlphabet, 5)()
		const dnsName = nodeName + '.casheye.io'
		const shebang = `#!/bin/bash

# install
apt-get update -y
add-apt-repository ppa:certbot/certbot -y
apt install nodejs npm -y
apt-get install certbot -y
apt-get upgrade -y

# ssl
INSTANCE_DNS_NAME=${dnsName}
certbot certonly --standalone -d $INSTANCE_DNS_NAME -n --agree-tos --email certs@casheye.io
certbot renew --dry-run

# build
git clone https://github.com/visionsofparadise/${serviceName}.git
cd ${serviceName}
cp "/etc/letsencrypt/live/${dnsName}/privkey.pem" dist
cp "/etc/letsencrypt/live/${dnsName}/fullchain.pem" dist
npm i
npm run test
npm run compile
npm i -g pm2
STAGE=${props.STAGE} SECRET=${secret} UNIT_TEST=false PORT=443 pm2 start dist/index.js
env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu`

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
			}),
			keyName: 'aws_ec2'
		})

		instance.connections.allowFromAnyIpv4(Port.tcp(22))
		instance.connections.allowFromAnyIpv4(Port.tcp(80))
		instance.connections.allowFromAnyIpv4(Port.tcp(443))
		instance.connections.allowFromAnyIpv4(Port.tcp(8333))
		instance.connections.allowFromAnyIpv4(Port.tcp(18333))

		EventBus.grantPutEvents(instance.grantPrincipal)

		const hostedZone = PublicHostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
			zoneName: 'casheye.io',
			hostedZoneId: SecretValue.secretsManager('CASHEYE_HOSTED_ZONE_ID').toString()
		});

		new ARecord(this, 'ARecord', {
			zone: hostedZone,
			target: RecordTarget.fromIpAddresses(instance.instancePublicIp),
			recordName: nodeName
		});

		this.instanceUrl = createOutput(this, deploymentName, 'instanceUrl', 'https://' + dnsName + '/');
		this.secret = createOutput(this, deploymentName, 'secret', secret);
	}
}