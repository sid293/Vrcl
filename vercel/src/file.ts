import fs from 'fs';
import axios from 'axios';
import {S3Client,PutObjectCommand, ListObjectsV2Command, GetObjectCommand, ListObjectsV2CommandOutput} from "@aws-sdk/client-s3";
import path from 'path';
import {dirname} from 'path';
import {exec, spawn} from "child_process";
import {promisify} from "util";
import {streamToString} from "./utils";

let execAsync = promisify(exec);

const s3Client = new S3Client({
    region:process.env.REGION,
    endpoint:process.env.ENDPOINT,
    credentials:{
        secretAccessKey:process.env.SECERET_ACCESS_KEY ?? '', 
        accessKeyId:process.env.ACCESS_KEY_ID ?? ''
    },
    requestHandler:{
        timeout:100000
    }
});

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

export async function uploadFolderTos3(s3filePath: string,localFilePath: string){
    let fileData;
    try{
        console.log("uploadfoldertos3 path ", s3filePath, localFilePath);
        if (!fs.existsSync(localFilePath)) {
            throw new Error(`File not found: ${localFilePath}`);
        }
        fileData = fs.readFileSync(localFilePath);
        console.log("file data read success");
        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.BUCKET || "first-v",
                Key: s3filePath,
                Body: fileData,
            })
        );
        console.log("folder uploaded to ",s3filePath);
    } catch (err) {
        console.error("error ",err);
    }

}

export function createFiles(path: string, data: string) {
    let filePath = path ?? "output";
    let dirPath = dirname(filePath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(path ?? "./output", data);
}

export async function getAllFilesFroms3(path: string){
    try{

    console.log("getting all files from s3");
    console.log("path ",path);
    const command = new ListObjectsV2Command({
        Bucket: "first-v",
        Prefix: path,
    });
    let response = await s3Client.send(command);
    let pathsArr = response.Contents?.map((entry)=>entry.Key); //[file,file]

    //TODO: go through pathsArr and get every file in output folder
    if(!pathsArr) return;
    console.log("got paths array ", pathsArr.length);
    let filesPromises = pathsArr?.map(async (path) => { 
        if(path === null || path === undefined){
            console.error("path is null");
            return;
        }
        const { Body } = await s3Client.send(
            new GetObjectCommand({
                Bucket: "first-v",
                Key: path,
            })
        );
        if (Body) {
            const data = await streamToString(Body as NodeJS.ReadableStream);
            //TODO: based on the "path" and "data" create folder in output
            createFiles(path,data);
        }
    })
    await Promise.all(filesPromises);
}catch(err){
    console.error("error getallfilesfroms3: ",err);
}
}

export function removeLocalRepo(pth: string, id: string){
    console.log("remove local repo");
    // console.log("path ",pth);
    let fullPath = path.join(pth,id);
    execAsync(`rm -r ${fullPath}`);
    // console.log("id ",id);
}

export async function checkRepoSize(repoUrl: string){
    try {
        console.log("Sending request for repo cloinig");
        let [owner, repo] = repoUrl.split("/").slice(-2);
        repo = repo.split(".")[0];
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
        let response = await axios.get(apiUrl);
        console.log("request successful ", response);
        console.log("response headers");
        console.log(response.headers['x-ratelimit-limit']);    // Total requests allowed
        console.log(response.headers['x-ratelimit-remaining']); // Remaining requests
        console.log(response.headers['x-ratelimit-reset']);
        let size = response.data.size;
        // console.log("repo size: ",size);
        if (size >= 100000) {
            return false;
        }
    }catch(err){
        console.error("Error repo cloning : ",err);
        return false;
    }
    return true;

}

export async function checkIfPresent(buildPath: string){
    console.log("checking if file present");
    try {
        await fs.promises.access(buildPath);
        return true;
    } catch (err) {
        console.log("file does not exist");
        return false;
    }
}