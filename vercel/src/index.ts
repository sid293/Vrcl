// import {Client} from "@upstash/qstash";
import {Redis} from "@upstash/redis";
import express from "express";
import {Readable} from 'stream';
import 'dotenv/config';
import fs from 'fs';
import cors from "cors";
import simpleGit from "simple-git";
import path from "path";
import {generate} from './utils';
import {getAllFiles, checkRepoSize, checkIfPresent, removeLocalRepo,getAllFilesFroms3,uploadFolderTos3} from "./file";
import {S3Client,PutObjectCommand, GetObjectCommand} from "@aws-sdk/client-s3";
import {exec} from "child_process";
import {promisify} from "util";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import { nextTick } from "process";
import {Request, Response, NextFunction} from 'express';
import {rateLimit} from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit:100,
    standardHeaders:'draft-7',
    legacyHeaders: false 
});

let execAsync = promisify(exec);
let app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: ['https://vrcl-frontend.vercel.app','http://localhost:5173'] }));
app.use(express.json());
let port = 3000;
const redis = new Redis({
    url:process.env.REDIS_URL,
    token:process.env.REDIS_TOKEN!});
let queueName = "vercelque";

// const s3Client = new S3Client({
//     region:"eu-central",
//     endpoint:"https://s3.eu-central-003.backblazeb2.com",
//     credentials:{
//         secretAccessKey:"K003nsWKvSQdr4QrWmFA4Y0mZTdw/uE", 
//         accessKeyId:"0035fb03ac09cc80000000001"
//     }
// });
const s3Client = new S3Client({
    region:process.env.REGION,
    endpoint:process.env.ENDPOINT,
    credentials:{
        secretAccessKey:process.env.SECERET_ACCESS_KEY ?? '', 
        accessKeyId:process.env.ACCESS_KEY_ID ?? ''
    }
});
// console.log("allfiles ",path.join(__dirname,"output/"));
// app.get("/redis",async (req,res)=>{
//     await redis.lpush(queueName,"data1");
//     let peek = await redis.lrange(queueName,-1,-1);
//     console.log("peek ",peek);
//     let ans = await redis.rpop(queueName);
//     console.log("ans ",ans);
//     res.send("completed");
// })

// app.get("/test", async (req, res) => {
//     let fileData;
//     try{
//         fileData = fs.readFileSync(path.join(__dirname,"my-first-object.txt"),"utf-8");
//         console.log('file data ',fileData);
//     }catch(err){
//         console.error("error ",err);
//     }
//     await s3Client.send(
//         new PutObjectCommand({
//             Bucket: "first-v",
//             Key: "newfolder/my-first-object.txt",
//             Body: fileData,
//         })
//     );

//     const { Body } = await s3Client.send(
//         new GetObjectCommand({
//         Bucket: "first-v",
//         Key: "newfolder/my-first-object.txt",
//         })
//     );
//     if(Body){
//         const data = await streamToString(Body as NodeJS.ReadableStream);
//         console.log("body ",data);
//     }
//     res.send("hellow");
// })

// function streamToString(stream: NodeJS.ReadableStream): Promise<string>{
//     const chunks: Uint8Array[] = [];
//     return new Promise((resolve,reject)=>{
//         stream.on("data",(chunk)=> chunks.push(chunk));
//         stream.on("error",(err)=> reject(err));
//         stream.on("end",()=> resolve(Buffer.concat(chunks).toString("utf8")));
//     })
// }

function verifyToken(req: Request,res: Response, next: NextFunction){
    try{
        if (!process.env.SECERET_PHRASE) {
            throw new Error('seceret passphrase not defined');
        }
        let token: string = req.headers.authentication as string;
        token = token.split(' ')[1];
        let decoded = jwt.verify(token, process.env.SECERET_PHRASE);
        if(decoded){
            // return true;
            next();
        }
    }catch(err){
        console.error("Error: ",err);
        // return false;
        res.status(400).json({success:false,message:"Unauthorized"});
    }
}


//should put it in r2 and put in queue redis 
app.post("/deploy",verifyToken ,async (req,res)=>{
    console.log("/deploy hit");
    const repoUrl = req.body.repoUrl;
    let id = generate();

    //TODO: redis, set status of id to cloning
    await redis.hset(id,{status:"cloning"});
    // let repoSize = await checkRepoSize(repoUrl);  get this working
    let repoSize = true;
    if(!repoSize){
        // throw new Error("The repo is too big");
        return res.send({success:false, error:"Repo is too big."});
    }
    try{
        await simpleGit().clone(repoUrl,`dist/output/${id}`);
    }catch(err: any){
        console.error("Error: Git clone failed");
        return res.send({success:false, error:"Git clone failed"});
    }

    // return;

    //TODO: GET FILE DATA AND PUT FILE IN S3 BUCKET WITH DTA
    let outputRoute = process.env.OUTPUT_ROUTE || "output/";
    let repoRoute = process.env.REPO_ROUTE || "repos/";
    let allFiles = getAllFiles(path.join(__dirname,outputRoute,id,"/")); //[localpath,localpathh,path]
    // let allFilesPromises = allFiles.map(async (filePath)=>{
    //     let repoFolderPath = repoRoute;
    //     let absPathLength = path.join(__dirname,outputRoute).length;
    //     repoFolderPath = path.join(repoFolderPath,filePath.slice(absPathLength));
    //     console.log("uploading to ",repoFolderPath,filePath);
    //     return uploadFolderTos3(repoFolderPath,filePath);
    // })
    // try {
    //     await Promise.all(allFilesPromises);
    //     console.log("upload complete ");
    // } catch (err) {
    //     console.error("promise failed ", err);
    // }
    for(let filePath in allFiles){
        let repoFolderPath = repoRoute;
        let absPathLength = path.join(__dirname,outputRoute).length;
        repoFolderPath = path.join(repoFolderPath,filePath.slice(absPathLength));
        console.log("uploading to ",repoFolderPath,filePath);
        await uploadFolderTos3(repoFolderPath,filePath);
    }


    //TODO: remove repo present locally
    // let repoPath = process.cwd();
    let repoPath = path.resolve(__dirname,outputRoute);
    removeLocalRepo(repoPath,id);

    //push id in redis queue
    console.log("pushing to redis");
    await redis.lpush(queueName,id);

    //TODO: redis, set status of id to "building"
    await redis.hset(id,{status:"building"});

    //TODO: delete output folder
    //change dir to output 
    // process.chdir();
    //remove everything from it - rm -r *
    // await execAsync("rm -r *");

    res.json({
        id:id
    })
})

app.get("/status",verifyToken ,async (req,res)=>{
    let id = req.query.id as string;
    console.log("hit status with id ",id);
    //TODO: get status from redis and send it back
    let statusResponse = await redis.hget(id,"status");
    res.json({status:statusResponse});
})

app.get("/deployment",async (req,res)=>{
    console.log("/deployment hit");
    let id = req.query.id as string;
    // let buildRoute = "builds/"
    let buildFolder = path.join(__dirname,"../",process.env.BULID_ROUTE?? "null",id);
    // let shouldBeBuildFolder = path.join(__dirname,`../builds/${id}`);
    // let buildFolder = path.join(__dirname,`../builds/${id}`);
    // let buildPath = `builds/${id}`;
    let buildPath = path.join(process.env.BULID_ROUTE?? "null",id);
    app.use(express.static(buildFolder));

    //TODO: check if already present
    if (await checkIfPresent(buildPath)) {
        console.log("its present");
        res.set("Content-Type", "text/html");
        return res.sendFile(path.join(buildFolder, `index.html`));
    }

    //TODO: get build from s3
    await getAllFilesFroms3(buildPath);

    //TODO: send it back with correct header 
    res.set("Content-Type","text/html");
    res.sendFile(path.join(buildFolder,`index.html`));
    // res.send("done");
})

app.get("/token",limiter ,(req,res)=>{
    if(!process.env.SECERET_PHRASE){
        throw new Error('seceret passphrase not defined');
    }
    let userId = uuidv4();
    let token = jwt.sign({userId},process.env.SECERET_PHRASE);
    res.json({token});
})

app.post("/checkToken",(req,res)=>{
    if(!process.env.SECERET_PHRASE){
        throw new Error('seceret passphrase not defined');
    }
    let token = req.body.token;
    let decoded = jwt.verify(token,process.env.SECERET_PHRASE);
    console.log("decoded and ",decoded);
})

app.listen(port,()=>{
    console.log("app listening on port ",port);
});
