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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllFiles = getAllFiles;
exports.createFiles = createFiles;
exports.getAllFilesFroms3 = getAllFilesFroms3;
exports.uploadFolderTos3 = uploadFolderTos3;
exports.buildRepo = buildRepo;
const child_process_1 = require("child_process");
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_1 = __importDefault(require("fs"));
const promises_1 = require("fs/promises");
const path = __importStar(require("path"));
const path_1 = require("path");
const util_1 = require("util");
const utils_1 = require("./utils");
let execAsync = (0, util_1.promisify)(child_process_1.exec);
const s3Object = {
    region: process.env.REGION,
    endpoint: process.env.ENDPOINT,
    credentials: {
        secretAccessKey: (_a = process.env.SECERET_ACCESS_KEY) !== null && _a !== void 0 ? _a : '',
        accessKeyId: (_b = process.env.ACCESS_KEY_ID) !== null && _b !== void 0 ? _b : ''
    }
};
const s3Client = new client_s3_1.S3Client(s3Object);
function getAllFiles(folderPath) {
    let response = [];
    let allFilesAndFolders = fs_1.default.readdirSync(folderPath);
    allFilesAndFolders.map((file) => {
        const fullFilePath = path.join(folderPath, file);
        if (fs_1.default.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath));
        }
        else {
            response.push(fullFilePath);
        }
    });
    return response;
}
function createFiles(pth, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!pth)
                return;
            let filePath = pth;
            // let filePath = path.resolve(pth);
            console.log("create files path is ", filePath);
            process.chdir(__dirname + "/..");
            // process.chdir(reposPath);
            // console.log("CHECK current working directory ",process.cwd());
            let dirPath = (0, path_1.dirname)(filePath);
            // console.log("dirpath ",dirPath);
            // if (!fs.existsSync(dirPath)) {
            //     fs.mkdirSync(dirPath, { recursive: true });
            //     let makedirres = await fs.promises.mkdir(dirPath, { recursive: true });
            //     console.log("dir create ", dirPath);
            // }
            try {
                yield (0, promises_1.access)(dirPath, promises_1.constants.F_OK);
                console.log("Directory already exists:", dirPath);
            }
            catch (_a) {
                yield fs_1.default.promises.mkdir(dirPath, { recursive: true });
                console.log("Directory created:", dirPath);
            }
            // fs.writeFileSync(path ?? "./output", data);
            let writefilesres = yield fs_1.default.promises.writeFile(filePath, data);
            console.log("writing files success ", writefilesres);
        }
        catch (err) {
            console.error("error writing files : ", err);
        }
    });
}
function getAllFilesFroms3(path) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log("getting files from s3");
            let fullPathsArr = [];
            let continuationToken;
            do {
                const command = new client_s3_1.ListObjectsV2Command({
                    Bucket: "first-v",
                    Prefix: path,
                    ContinuationToken: continuationToken
                });
                let response = yield s3Client.send(command);
                let pathsArr = (_a = response.Contents) === null || _a === void 0 ? void 0 : _a.map((entry) => entry.Key); //[file,file]
                continuationToken = response.NextContinuationToken;
                if (pathsArr) {
                    fullPathsArr.push(...pathsArr);
                }
            } while (continuationToken);
            //TODO: go through pathsArr and get every file in output folder
            // console.log("paths arr is ",pathsArr);
            if (!fullPathsArr)
                return;
            console.log("got paths array ");
            let downloadPromises = fullPathsArr === null || fullPathsArr === void 0 ? void 0 : fullPathsArr.map((pth) => __awaiter(this, void 0, void 0, function* () {
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
                };
                const command = new client_s3_1.GetObjectCommand(input);
                // console.log("command is ",command);
                const { Body } = yield s3Client.send(command);
                // console.log("body is ");
                if (Body) {
                    const data = yield (0, utils_1.streamToString)(Body);
                    //TODO: based on the "path" and "data" create folder in output
                    console.log("creating file");
                    yield createFiles(pth, data);
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
            }));
            yield Promise.all(downloadPromises);
            console.log("got all files from s3");
        }
        catch (err) {
            console.error("error getallfilesfroms3 : ", err);
        }
    });
}
function uploadFolderTos3(s3filePath, localFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let fileData;
        try {
            // fileData = fs.readFileSync(localFilePath);
            fileData = yield fs_1.default.promises.readFile(localFilePath);
            yield s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: "first-v",
                Key: s3filePath,
                Body: fileData,
            }));
        }
        catch (err) {
            console.error("error ", err);
        }
    });
}
function buildRepo(reposPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            // await buildRepo(reposPath);
            //giving no such file or directory
            console.log("building");
            process.chdir(__dirname + "/..");
            process.chdir(reposPath);
            execAsync("npm install && npm run build")
                .then(() => resolve(true))
                .catch((err) => {
                console.error("Error: ", err);
                reject(false);
            });
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
        });
        // let buildTmr = setTimeout(async()=>{
        //     childp.kill("SIGINT");
        //     console.log("set timeout running");
        //     await execAsync("npm install");
        //     await execAsync("npm run build"); //repos/ip/build
        // },30000);
    });
}
