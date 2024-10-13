"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const redis_1 = require("@upstash/redis");
require("dotenv/config");
const file_1 = require("./file");
const utils_1 = require("./utils");
const path = __importStar(require("path"));
// import {S3Client,ListObjectsV2Command ,PutObjectCommand, GetObjectCommand} from "@aws-sdk/client-s3";
let execAsync = (0, util_1.promisify)(child_process_1.exec);
console.log("worker started");
const redis = new redis_1.Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN
});
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
function ProcessQueue() {
    return __awaiter(this, void 0, void 0, function* () {
        let count = 0;
        while (count < 1) {
            console.log("loop running ");
            // count ++; TESTING
            //TODO: if id exist get id from redis queue
            let id = yield redis.rpop(queueName);
            // let id = "s2z6y"; //TESTING 
            // console.log("id ",id);
            if (!id) {
                yield (0, utils_1.delay)(5000);
                continue;
            }
            let reposPath = `repos/${id}`;
            //TODO: get repo from s3 store to local
            try {
                // console.log("delay 3");
                yield (0, utils_1.delay)(3000);
                yield (0, file_1.getAllFilesFroms3)(reposPath);
            }
            catch (err) {
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
                let buildResponse = yield (0, file_1.buildRepo)(reposPath);
                if (!buildResponse) {
                    yield redis.hset(id, { status: "failed" });
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
                if (fs_1.default.existsSync(path.join(__dirname, `../repos/${id}/build`))) {
                    outputDir = 'build';
                }
                else if (fs_1.default.existsSync(path.join(__dirname, `../repos/${id}/dist`))) {
                    outputDir = 'dist';
                }
                else {
                    yield redis.hset(id, { status: "failed" });
                    throw new Error("no build or dist folder found");
                    continue;
                }
                let localFilesPath = (0, file_1.getAllFiles)(path.join(__dirname, `../repos/${id}/${outputDir}/`));
                let buildPath = `builds/${id}`;
                console.log("uploading build to s3");
                localFilesPath.map((lpath) => __awaiter(this, void 0, void 0, function* () {
                    let partToRemoveLenght = path.join(__dirname, `../repos/${id}/build`).length;
                    let s3buildPath = path.join(buildPath, lpath.slice(partToRemoveLenght));
                    yield (0, file_1.uploadFolderTos3)(s3buildPath, lpath);
                }));
            }
            catch (err) {
                console.log("build failed");
                yield redis.hset(id, { status: "failed" });
                console.error(err);
                continue;
            }
            //TODO: remove project local project folder 
            process.chdir(__dirname + "/..");
            process.chdir("repos");
            execAsync(`rm -r ${id}`);
            //TODO: update status in db deployed
            yield redis.hset(id, { status: "deployed" });
            console.log("deployed");
        }
    });
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
