
import {exec, spawn} from "child_process";
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
        // let filePath = path.resolve(pth);
        console.log("create files path is ",filePath);
        process.chdir(__dirname+"/..");
        // process.chdir(reposPath);
        // console.log("CHECK current working directory ",process.cwd());

        let dirPath = dirname(filePath);
        // console.log("dirpath ",dirPath);
        // if (!fs.existsSync(dirPath)) {
        //     fs.mkdirSync(dirPath, { recursive: true });
        //     let makedirres = await fs.promises.mkdir(dirPath, { recursive: true });
        //     console.log("dir create ", dirPath);
        // }
        try {
            await access(dirPath, constants.F_OK);
            console.log("Directory already exists:", dirPath);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
            console.log("Directory created:", dirPath);
        }
        
        // fs.writeFileSync(path ?? "./output", data);
        let writefilesres = await fs.promises.writeFile(filePath, data);
        console.log("writing files success ",writefilesres);
    } catch (err) {
        console.error("error writing files : ",err);
    }
}


export async function getAllFilesFroms3(path: string) {
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
        // console.log("paths arr is ",pathsArr);
        if (!fullPathsArr) return;
        console.log("got paths array ");
        let downloadPromises = fullPathsArr?.map(async (pth) => { //repos/id/filepath
            // for(let i=0;i<pathsArr.length;i++){
            // let pth = pathsArr[i];
            console.log("path is ", pth);
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
            // console.log("command is ",command);
            const { Body } = await s3Client.send(command);
            // console.log("body is ");
            if (Body) {
                const data = await streamToString(Body as NodeJS.ReadableStream);
                //TODO: based on the "path" and "data" create folder in output
                console.log("creating file");
                await createFiles(pth, data);
                //create files start
                // let path = pth;
                // try {
                //     console.log("create files path is ", path);
                //     if (!path) return;
                //     let filePath = path;
                //     let dirPath = dirname(filePath);
                //     // console.log("dirpath ",dirPath);
                //     if (!fs.existsSync(dirPath)) {
                //         // fs.mkdirSync(dirPath, { recursive: true });
                //         let makedirres = await fs.promises.mkdir(dirPath, { recursive: true });
                //         console.log("dir create ", dirPath);
                //     }
                //     // while(!fs.existsSync(dirPath)){
                //     //     // fs.mkdirSync(dirPath, { recursive: true });
                //     //     let makedirres = await fs.promises.mkdir(dirPath, { recursive: true });
                //     //     console.log("dir create ", dirPath);
                //     // }
                //     if(fs.existsSync(dirPath)){
                //         console.log("dirpath exist",dirPath);
                //     }
                //     // fs.writeFileSync(path ?? "./output", data);
                //     let writefilesres = await fs.promises.writeFile(filePath, data);
                //     // await fs.access(filePath);
                //     console.log("writing files success ", writefilesres);
                // } catch (err) {
                //     console.error("error writing files : ", err);
                // }
                //create files end

            }
            // }
        })
        await Promise.all(downloadPromises);
        console.log("got all files from s3");
    } catch (err) {
        console.error("error getallfilesfroms3 : ", err);
    }
}

export async function uploadFolderTos3(s3filePath: string,localFilePath: string){
    let fileData;
    try{
        // fileData = fs.readFileSync(localFilePath);
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
        // await buildRepo(reposPath);
        //giving no such file or directory
        console.log("building");
        process.chdir(__dirname+"/..");
        process.chdir(reposPath);
        execAsync("npm install && npm run build")
            .then(()=>resolve(true))
            .catch((err)=>{
                console.error("Error: ",err);
                reject(false);
            })

        //USING SPAWN
        // let childp = spawn("npm install && npm run build", { shell: true });
        // childp.stderr.on("data", (data) => {
        //     console.error("Error: ", data.toString());
        //     reject(false);
        // });
        // childp.stdout.on("data", (data) => {
        //     // console.log("buildrepo data ", data.toString());
        //     // return true;
        // });
        // childp.on("close", (code) => {
        //     if (code === 0) {
        //         console.log("build succcess ");
        //         resolve(true);
        //     } else {
        //         reject(false);
        //     }
        // })
    })

            // let buildTmr = setTimeout(async()=>{
            //     childp.kill("SIGINT");
            //     console.log("set timeout running");
            //     await execAsync("npm install");
            //     await execAsync("npm run build"); //repos/ip/build

            // },30000);

}