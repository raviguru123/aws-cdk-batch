import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as batch from "@aws-cdk/aws-batch";
import * as iam from "@aws-cdk/aws-iam";
import * as lambda from "@aws-cdk/aws-lambda";
import * as events from "@aws-cdk/aws-events";
import * as targets from "@aws-cdk/aws-events-targets";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { Rule } from "@aws-cdk/aws-events";

config();

const functionName = "batch-lambda";
const eventFunctionName = "event-batch-lambda";
const firstjobDefinitionName = "job-definition";
const secondjobDefinitionName = "second-job-definition";
const computeEnvironmentName = "compute-environment";
const jobQueueName = "job-queue-gamma-onebox";
const srcPath = `${__dirname}/lambdaHandler.js`;

export class BatchService extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);

        const vpc = new ec2.Vpc(this, "vpc", {
            maxAzs: 3
        });
        const sg = new ec2.SecurityGroup(this, "sg", {
            securityGroupName: "batch-sg",
            vpc
        });

        const stsAssumeRoleStatement = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["sts:AssumeRole"],
            resources: ["*"]
        });

        const table = new dynamodb.Table(this, 'Table', {
            tableName: "TestTable",
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.NUMBER,
            },
            sortKey: {
                name: "sk",
                type: dynamodb.AttributeType.NUMBER
            }
        });


        const table2 = new dynamodb.Table(this, 'ddbTable', {
            tableName: "TestTableNext",
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.NUMBER,
            },
            sortKey: {
                name: "sk",
                type: dynamodb.AttributeType.NUMBER
            }
        });


        const jobSubmitStatement = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["batch:SubmitJob"],
            resources: ["*"]
        });

        const ddbWriteStatemenr = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["batch:SubmitJob"],
            resources: ["*"]
        });

        const batchServiceRole = new iam.Role(this, "service-role", {
            assumedBy: new iam.ServicePrincipal("batch.amazonaws.com"),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSBatchServiceRole")],
        });

        batchServiceRole.addToPolicy(stsAssumeRoleStatement);

        const instanceRole = new iam.Role(this, "instance-role", {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2ContainerServiceforEC2Role")],
        });

        table.grantReadWriteData(instanceRole);
        table2.grantReadWriteData(instanceRole);

        instanceRole.addToPolicy(stsAssumeRoleStatement);

        const instanceProfile = new iam.CfnInstanceProfile(this, "instance-profile", {
            instanceProfileName: "instance-profile",
            roles: [
                instanceRole.roleName
            ]
        });

        const jobDefinition = new batch.CfnJobDefinition(this, "job-definition", {
            jobDefinitionName: firstjobDefinitionName,
            type: "Container",
            containerProperties: {
                command: ["python", "/src/bulkload.py"],
                environment: [
                    { name: "MY_VAR", value: "Good" }
                ],
                image: "raviguru007/aws-batch-007:latest",
                vcpus: 2,
                memory: 4096
            },
            retryStrategy: {
                attempts: 3
            },
            timeout: {
                attemptDurationSeconds: 60
            }
        });


        const jobDefinition1 = new batch.CfnJobDefinition(this, "job-definition-second", {
            jobDefinitionName: secondjobDefinitionName,
            type: "Container",
            containerProperties: {
                command: ["python", "/src/bulkload.py"],
                environment: [
                    { name: "MY_VAR", value: "Good" }
                ],
                image: "raviguru007/emailpayload:latest",
                vcpus: 2,
                memory: 4096
            },
            retryStrategy: {
                attempts: 3
            },
            timeout: {
                attemptDurationSeconds: 60
            }
        });

        const computeEnvironemnt = new batch.CfnComputeEnvironment(this, "compute-environment", {
            computeEnvironmentName,
            computeResources: {
                minvCpus: 5,
                desiredvCpus: 5,
                maxvCpus: 200,
                instanceTypes: [
                    "optimal"
                ],
                instanceRole: instanceProfile.attrArn,
                type: "EC2",
                subnets: vpc.publicSubnets.map(x => x.subnetId),
                securityGroupIds: [sg.securityGroupId]
            },
            serviceRole: batchServiceRole.roleArn,
            type: "MANAGED",
            state: "ENABLED"
        });


        computeEnvironemnt.addDependsOn(instanceProfile);

        const jobQueue = new batch.CfnJobQueue(this, "job-queue", {
            jobQueueName,
            priority: 1,
            state: "ENABLED",
            computeEnvironmentOrder: [
                { order: 1, computeEnvironment: computeEnvironemnt.computeEnvironmentName as string }
            ]
        });
        jobQueue.addDependsOn(computeEnvironemnt);



        const lambdaFunction = new lambda.Function(this, "lambda-function", {
            functionName,
            code: lambda.Code.fromAsset("resources"),
            handler: "job-handler.main",
            timeout: cdk.Duration.seconds(30),
            runtime: lambda.Runtime.NODEJS_10_X,
            environment: {
                REGION: process.env.AWS_REGION as string,
                JOB_DEFINITION: firstjobDefinitionName,
                JOB_QUEUE: jobQueueName,
                SECOND_JOB_DEFINITION: secondjobDefinitionName
            },
            initialPolicy: [jobSubmitStatement]
        });

        const rule = new events.Rule(this, 'event-rule', {
            schedule: events.Schedule.expression('rate(2 minutes)')
        });

        rule.addTarget(new targets.LambdaFunction(lambdaFunction));

        const lambdaFunctionBatchEventHandler = new lambda.Function(this, "event-lambda-function", {
            functionName: eventFunctionName,
            code: lambda.Code.fromAsset("resources"),
            handler: "batch-event-handler.main",
            runtime: lambda.Runtime.NODEJS_10_X
        });


        const rule1 = new events.Rule(this, "batch-event-rule", {
            eventPattern: {
                source: ["aws.batch"]
            }
        });


        rule1.addTarget(new targets.LambdaFunction(lambdaFunctionBatchEventHandler));
    }
}