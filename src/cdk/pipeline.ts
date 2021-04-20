import { Stack, Construct, StackProps, SecretValue, Fn } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { CasheyeBitcoinNodeStage } from './stack';
import { App } from '@aws-cdk/core';
import { EventBus } from '@aws-cdk/aws-events';
import { PolicyStatement } from '@aws-cdk/aws-iam';

export const serviceName = 'casheye-bitcoin-node';

export class CasheyeBitcoinNodePipelineStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const sourceArtifact = new Artifact();
		const cloudAssemblyArtifact = new Artifact();

		const sourceAction = new GitHubSourceAction({
			actionName: 'source',
			owner: 'visionsofparadise',
			repo: serviceName,
			oauthToken: SecretValue.secretsManager('GITHUB_TOKEN'),
			output: sourceArtifact,
			branch: 'master'
		});

		const synthAction = new SimpleSynthAction({
			sourceArtifact,
			cloudAssemblyArtifact,
			installCommands: ['npm i'],
			buildCommands: [
				`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
				'npm run compile',
				'npm run build'
				],
			testCommands: ['npm run test'],
			synthCommand: 'npm run synth'
		});

		const pipeline = new CdkPipeline(this, 'pipeline', {
			pipelineName: serviceName + '-pipeline',
			cloudAssemblyArtifact,
			sourceAction,
			synthAction
		});

		const testApp = new CasheyeBitcoinNodeStage(this, serviceName + '-regtest-test', {
			STAGE: 'test',
			NETWORK: 'regtest'
		});

		const testAppStage = pipeline.addApplicationStage(testApp);

		const testEnv = [
			'STAGE=test',
			`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
			`TEST_XPUBKEY=${SecretValue.secretsManager('TEST_XPUBKEY_BTC')}`,
			`WEBSOCKET_URL=${Fn.importValue(`casheye-webhook-test-websocketUrl`)}`
		]

		const outputs = {
			INSTANCE_URL: pipeline.stackOutput(testApp.instanceUrl!),
			TEST_URL: pipeline.stackOutput(testApp.testUrl!),
		}

		const integrationTestAction = new ShellScriptAction({
			actionName: 'Integration',
			runOrder: testAppStage.nextSequentialRunOrder(),
			additionalArtifacts: [sourceArtifact],
			commands: [
				'sleep 300s',
				...testEnv,
				'npm rm bitcoind',
				'npm ci',
				'npm run initialize',
				'npm run integration'
			],
			useOutputs: outputs,
			rolePolicyStatements: [
				new PolicyStatement({
					resources: ['*'],
					actions: ['sqs:*']
				})
			]
		})

		testAppStage.addActions(integrationTestAction)

		EventBus.grantAllPutEvents(integrationTestAction)

		// const testnetApp = new CasheyeBitcoinNodeStage(this, serviceName + '-testnet-prod', {
		// 	STAGE: 'prod',
		// 	NETWORK: 'testnet'
		// });

		// pipeline.addApplicationStage(testnetApp);

		// const mainnetApp = new CasheyeBitcoinNodeStage(this, serviceName + '-mainnet-prod', {
		// 	STAGE: 'prod',
		// 	NETWORK: 'mainnet'
		// });

		// pipeline.addApplicationStage(mainnetApp);
	}
}

const app = new App();

new CasheyeBitcoinNodePipelineStack(app, `${serviceName}-pipeline-stack`, {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: 'us-east-1'
	}
});

app.synth();