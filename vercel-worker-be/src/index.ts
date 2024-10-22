import express from 'express';
import cors from 'cors';
import {exec, spawn} from "child_process";
import {promisify} from "util";
import fs from 'fs';
import {Redis} from "@upstash/redis";
import 'dotenv/config';
import {uploadFolderTos3,buildRepo, getAllFiles,getAllFilesFroms3} from "./file";
import {delay} from "./utils";
import * as path from "path";
let execAsync = promisify(exec);
let app = express();
app.use(cors());

console.log("worker started");
const redis = new Redis({
    url:process.env.REDIS_URL,
    token:process.env.REDIS_TOKEN!});
let queueName = "vercelque";

async function ProcessQueue() {
    let count = 0;
    while (count < 20) {
        console.log("loop running ");
        count ++;

        //TODO: if id exist get id from redis queue
        let id = await redis.rpop(queueName);
        if(!id){
            await delay(10000);
            continue;
        }
        let reposPath = `repos/${id}`;

        //TODO: get repo from s3 store to local
        try{
            await getAllFilesFroms3(reposPath, redis, id);
        }catch(err){
            console.error(err);
        }

        try {
            //TODO: build project
            let buildResponse = await buildRepo(reposPath);
            if(!buildResponse){
                await redis.hset(id,{status:"failed"});
                console.log("build failed returning");
                continue;
            }

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

app.get("/start",(req,res)=>{
    ProcessQueue();
})

app.listen(3001,()=>{
    console.log("app running on port 3001");
})
