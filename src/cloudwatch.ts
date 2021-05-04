import AWS from 'aws-sdk'

export const cloudwatch = new AWS.CloudWatch({ apiVersion: '2010-08-01', region: 'us-east-1' });
export const cloudwatchLogs = new AWS.CloudWatchLogs({ apiVersion: '2014-03-28', region: 'us-east-1' });