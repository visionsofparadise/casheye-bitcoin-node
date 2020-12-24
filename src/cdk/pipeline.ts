import { Stack, Construct, StackProps, SecretValue } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { CasheyeAddressWatcherStage } from './stack';
import { App } from '@aws-cdk/core';
import { EventBus } from '@aws-cdk/aws-events';

export const serviceName = 'casheye-address-watcher';

export class CasheyeAddressWatcherPipelineStack extends Stack {
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

		const testApp = new CasheyeAddressWatcherStage(this, serviceName + '-test', {
			STAGE: 'test'
		});

		const testAppStage = pipeline.addApplicationStage(testApp);

		const testEnv = [
			'STAGE=test',
			`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
			`TEST_XPUBKEY=${SecretValue.secretsManager('TEST_XPUBKEY')}`,
		]

		const outputs = {
			INSTANCE_URL: pipeline.stackOutput(testApp.instanceUrl!)
		}

		const integrationTestAction = new ShellScriptAction({
			actionName: 'Integration',
			runOrder: testAppStage.nextSequentialRunOrder(),
			additionalArtifacts: [sourceArtifact],
			commands: [
				'sleep 300s',
				...testEnv,
				'npm rm bitcoind',
				'npm i',
				'npm run integration'
			],
			useOutputs: outputs
		})

		testAppStage.addActions(integrationTestAction)

		testEnv.push('PERFORMANCE_TEST_N=100')

		const performanceTestAction = new ShellScriptAction({
			actionName: 'Performance',
			runOrder: testAppStage.nextSequentialRunOrder(),
			additionalArtifacts: [sourceArtifact],
			commands: [
				'sleep 5s',
				...testEnv,
				'npm rm bitcoind',
				'npm i',
				'npm run performance'
			],
			useOutputs: outputs
		})

		testAppStage.addActions(performanceTestAction)

		EventBus.grantPutEvents(integrationTestAction)
		EventBus.grantPutEvents(performanceTestAction)

		pipeline.addStage('Approval').addManualApprovalAction({
			actionName: 'Approval'
		})

		const prodApp = new CasheyeAddressWatcherStage(this, serviceName + '-prod', {
			STAGE: 'prod'
		});

		pipeline.addApplicationStage(prodApp);
	}
}

const app = new App();

new CasheyeAddressWatcherPipelineStack(app, `${serviceName}-pipeline-stack`, {
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: 'us-east-1'
	}
});

app.synth();