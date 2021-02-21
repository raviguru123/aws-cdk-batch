import { resolve } from "dns";

const Batch = require("aws-sdk").Batch;

const batch = new Batch({
    region: process.env.REGION
});

exports.main = async (event: any, context: any, callback: any) => {
    try {
        const jobName = `job_${Date.now()}`;

        const response = await batch.submitJob({
            jobDefinition: process.env.JOB_DEFINITION,
            jobQueue: process.env.JOB_QUEUE,
            jobName
        }).promise();




        console.log("resJson", response);

        const jobId = response.jobId;
        console.log("<========= First Job Id ++==========>", jobId);

        const secondJobResponse = await batch.submitJob({
            jobDefinition: process.env.SECOND_JOB_DEFINITION,
            jobQueue: process.env.JOB_QUEUE,
            jobName,
            dependsOn: [{
                jobId: jobId,
                type: "SEQUENTIAL"
            }]
        }).promise();


        console.log("<============= Second Job Id ++==========>", secondJobResponse.jobId);
        callback(null, "done");

    } catch (err) {
        console.error(err);
        callback("Internal error");
    }
}