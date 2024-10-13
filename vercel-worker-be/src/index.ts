
import {exec, spawn} from "child_process";
import {promisify} from "util";
import fs from 'fs';
import {Redis} from "@upstash/redis";
import 'dotenv/config';
import {uploadFolderTos3,buildRepo, getAllFiles,getAllFilesFroms3} from "./file";
import {delay} from "./utils";
import * as path from "path";
// import {S3Client,ListObjectsV2Command ,PutObjectCommand, GetObjectCommand} from "@aws-sdk/client-s3";
let execAsync = promisify(exec);

console.log("worker started");

const redis = new Redis({
    url:process.env.REDIS_URL,
    token:process.env.REDIS_TOKEN!});
let queueName = "vercelque";
// const s3Client = new S3Client({
//     region:process.env.REGION,
//     endpoint:process.env.ENDPOINT,
//     credentials:{
//         secretAccessKey:process.env.SECERET_ACCESS_KEY ?? '', 
//         accessKeyId:process.env.ACCESS_KEY_ID ?? ''
//     }
// });

// async function delay(time: number){
//     return new Promise((resolve)=>{
//         setTimeout(resolve, time);
//     })
// }

async function ProcessQueue() {
    let count = 0;
    while (count < 1) {
        console.log("loop running ");
        // count ++; TESTING
        //TODO: if id exist get id from redis queue
        let id = await redis.rpop(queueName);
        // let id = "s2z6y"; //TESTING 
        // console.log("id ",id);
        if(!id){
            await delay(5000);
            continue;
        }
        let reposPath = `repos/${id}`;

        //TODO: get repo from s3 store to local
        try{
            // console.log("delay 3");
            await delay(3000);
            await getAllFilesFroms3(reposPath);
        }catch(err){
            console.error(err);
        }
        // try{
            // await delay(1000);
        // }catch(err){
            // console.log('err ',err);
        // }
        // console.log("got files from s3");

        try {
            //TODO: build project
            let buildResponse = await buildRepo(reposPath);
            if(!buildResponse){
                await redis.hset(id,{status:"failed"});
                console.log("build failed returning");
                continue;
            }
            // let buildResult = await execAsync("npm run build"); //repos/ip/build
            // clearTimeout(tmr);
            // console.log("build result ",buildResult);
            // await delay(1000);

            //TODO: push build to s3
            console.log("pushing build to s3");
            let outputDir = '';
            if (fs.existsSync(path.join(__dirname, `../repos/${id}/build`))) {
                outputDir = 'build';
            } else if (fs.existsSync(path.join(__dirname, `../repos/${id}/dist`))) {
                outputDir = 'dist';
            } else {
                await redis.hset(id,{status:"failed"});
                throw new Error("no build or dist folder found");
                continue;
            }
            let localFilesPath = getAllFiles(path.join(__dirname, `../repos/${id}/${outputDir}/`));
            let buildPath = `builds/${id}`;
            console.log("uploading build to s3");
            localFilesPath.map(async (lpath) => {
                let partToRemoveLenght = path.join(__dirname, `../repos/${id}/build`).length;
                let s3buildPath = path.join(buildPath, lpath.slice(partToRemoveLenght))
                await uploadFolderTos3(s3buildPath, lpath);
            })
        } catch (err) {
            console.log("build failed");
            await redis.hset(id,{status:"failed"});
            console.error(err);
            continue;
        }

        //TODO: remove project local project folder 
        process.chdir(__dirname+"/..");
        process.chdir("repos");
        execAsync(`rm -r ${id}`)


        //TODO: update status in db deployed
        await redis.hset(id,{status:"deployed"});
        console.log("deployed");
    }
}

// function streamToString(stream: NodeJS.ReadableStream): Promise<string>{
//     const chunks: Uint8Array[] = [];
//     return new Promise((resolve,reject)=>{
//         stream.on("data",(chunk)=> chunks.push(chunk));
//         stream.on("error",(err)=> reject(err));
//         stream.on("end",()=> resolve(Buffer.concat(chunks).toString("utf8")));
//     })
// }

// async function getAllFilesFroms3(path: string){
//     const command = new ListObjectsV2Command({
//         Bucket: "first-v",
//         Prefix: path,
//     });
//     let response = await s3Client.send(command);
//     let pathsArr = response.Contents?.map((entry)=>entry.Key); //[file,file]

//     //TODO: go through pathsArr and get every file in output folder
//     pathsArr?.map(async (path) => { //repos/id/filepath
//         if(path === null || path === undefined){
//             console.error("path is null");
//             return;
//         }
//         const { Body } = await s3Client.send(
//             new GetObjectCommand({
//                 Bucket: "first-v",
//                 Key: path,
//             })
//         );
//         if (Body) {
//             const data = await streamToString(Body as NodeJS.ReadableStream);
//             //TODO: based on the "path" and "data" create folder in output
//             createFiles(path,data);
//         }
//     })
// }


ProcessQueue();