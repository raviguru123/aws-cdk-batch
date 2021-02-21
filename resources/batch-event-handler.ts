//batch-event-handler.ts
exports.main = async (event: any, context: any, callback: any) => {
    console.log("<<<<<===========batch event executed========================>>>>>>>>>");
    console.log("<<<<<<==== jobId ====>>>>>>>>", event.detail.jobId);
    console.log("<<<<<<==== status ====>>>>>>>>", event.detail.status);
    console.log("<========++++@@@@@@@@@@@@@@@@+++++===========>");
}