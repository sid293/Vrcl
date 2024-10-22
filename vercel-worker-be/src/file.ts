import {Redis} from '@upstash/redis';
import {exec} from "child_process";
import {S3Client, ListObjectsV2Command,PutObjectCommand, GetObjectCommand} from "@aws-sdk/client-s3";
import fs from 'fs';
import {access, constants} from 'fs/promises';
import * as path from "path";
import {dirname} from 'path';
import {promisify} from "util";
import {streamToString} from './utils';

let execAsync = promisify(exec);

const s3Object = {
    region:process.env.REGION,
    endpoint:process.env.ENDPOINT,
    credentials:{
        secretAccessKey:process.env.SECERET_ACCESS_KEY ?? '', 
        accessKeyId:process.env.ACCESS_KEY_ID ?? ''
    }
}
const s3Client = new S3Client(s3Object);

export function getAllFiles(folderPath: string){
    let response: string[] = [];

    let allFilesAndFolders = fs.readdirSync(folderPath);
    allFilesAndFolders.map((file)=>{
        const fullFilePath = path.join(folderPath,file);
        if(fs.statSync(fullFilePath).isDirectory()){
            response = response.concat(getAllFiles(fullFilePath));
        }else{
            response.push(fullFilePath);
        }
    })
    return response;
}


export async function createFiles(pth: string, data: string) {
    try {
        if(!pth) return;
        let filePath = pth;
        console.log("create files path is ",filePath);
        process.chdir(__dirname+"/..");
        let dirPath = dirname(filePath);
        try {
            await access(dirPath, constants.F_OK);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
        let writefilesres = await fs.promises.writeFile(filePath, data);
        console.log("writing files success ",writefilesres);
    } catch (err) {
        console.error("error writing files : ",err);
    }
}


export async function getAllFilesFroms3(path: string, redis: Redis , id: string) {
    try {
        console.log("getting files from s3");
        let fullPathsArr: string[] = [];
        let continuationToken: string | undefined;
        do {
            const command = new ListObjectsV2Command({
                Bucket: "first-v",
                Prefix: path,
                ContinuationToken:continuationToken
            });
            let response = await s3Client.send(command);
            let pathsArr = response.Contents?.map((entry) => entry.Key); //[file,file]
            continuationToken = response.NextContinuationToken;
            if(pathsArr){
                fullPathsArr.push(...(pathsArr as string[]));
            }
        } while (continuationToken);

        //TODO: go through pathsArr and get every file in output folder
        if (!fullPathsArr) return;
        let downloadPromises = fullPathsArr?.map(async (pth) => { //repos/id/filepath
            if (!pth) {
                console.error("path is null");
                return;
            }
            //ERROR body is not working.
            const input = {
                Bucket: process.env.BUCKET,
                Key: pth
            }
            const command = new GetObjectCommand(input);
            const { Body } = await s3Client.send(command);
            if (Body) {
                const data = await streamToString(Body as NodeJS.ReadableStream);
                //TODO: based on the "path" and "data" create folder in output
                console.log("creating file");
                await createFiles(pth, data);
            }
        })
        await Promise.all(downloadPromises);
        console.log("got all files from s3");
    } catch (err) {
        console.error("error getallfilesfroms3 : ", err);
        await redis.hset(id, { status: "failed" });
    }
}

export async function uploadFolderTos3(s3filePath: string,localFilePath: string){
    let fileData;
    try{
        fileData = await fs.promises.readFile(localFilePath);
        await s3Client.send(
            new PutObjectCommand({
                Bucket: "first-v",
                Key: s3filePath,
                Body: fileData,
            })
        );
    }catch(err){
        console.error("error ",err);
    }
}


export async function buildRepo(reposPath: string): Promise<boolean>{
    return new Promise((resolve, reject) => {
        console.log("building");
        process.chdir(__dirname+"/..");
        process.chdir(reposPath);
        console.log("building in project: ",process.cwd());
        execAsync("npm install && npm run build")
            .then(({stdout, stderr})=>{
                console.log("npm build output");
                console.log(stdout);
                if(stderr){
                    console.error("error or warning");
                    console.error(stderr);
                }
                resolve(true)})
            .catch((err)=>{
                console.error("Error: ",err);
                reject(false);
            })
    })
}