import { Stack, Construct, StackProps, SecretValue, Fn } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { CasheyeAddressWatcherStage } from './stack';
import { App } from '@aws-cdk/core';
import { PolicyStatement } from '@aws-cdk/aws-iam';

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

		const queueSendPolicy = new PolicyStatement({
			actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
			resources: ['*']
		})

		const testEnv = [
			'STAGE=test',
			`CDK_DEFAULT_ACCOUNT=${SecretValue.secretsManager('ACCOUNT_NUMBER')}`,
			`UTILITY_API_URL=${Fn.importValue('casheye-utility-test-apiUrl')}`,
			`TEST_XPUBKEY=${SecretValue.secretsManager('TEST_XPUBKEY')}`,
		]

		const outputs = {
			QUEUE_URL: pipeline.stackOutput(testApp.queueUrl),
			INSTANCE_URL: pipeline.stackOutput(testApp.instanceUrl)
		}

		testAppStage.addActions(
			new ShellScriptAction({
				actionName: 'Integration',
				runOrder: testAppStage.nextSequentialRunOrder(),
				additionalArtifacts: [sourceArtifact],
				commands: [
					'sleep 300s',
					...testEnv,
					'npm i',
					'npm run integration'
				],
				useOutputs: outputs,
				rolePolicyStatements: [queueSendPolicy]
			})
		)

		testEnv.push('PERFORMANCE_TEST_N=500')

		testAppStage.addActions(
			new ShellScriptAction({
				actionName: 'Performance',
				runOrder: testAppStage.nextSequentialRunOrder(),
				additionalArtifacts: [sourceArtifact],
				commands: [
					'sleep 5s',
					...testEnv,
					'npm i',
					'npm run performance'
				],
				useOutputs: outputs,
				rolePolicyStatements: [queueSendPolicy]
			})
		)

		// pipeline.addStage('Approval').addManualApprovalAction({
		// 	actionName: 'Approval'
		// })

		// const prodApp = new CasheyeAddressWatcherStage(this, serviceName + '-prod', {
		// 	STAGE: 'prod'
		// });

		// pipeline.addApplicationStage(prodApp);
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