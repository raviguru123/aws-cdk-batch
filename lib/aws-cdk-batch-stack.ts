import * as cdk from '@aws-cdk/core';

import * as cdkService from './batch-service';

const functionName = "batch-lambda";
const jobDefinitionName = "job-definition";
const computeEnvironmentName = "compute-environment";
const jobQueueName = "job-queue";
const srcPath = `${__dirname}/lambdaHandler.js`;

export class AwsCdkBatchStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new cdkService.BatchService(scope, "awsBatch");
    // The code that defines your stack goes here
  }
}
