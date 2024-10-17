"use strict";
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
exports.uploadFolderTos3 = uploadFolderTos3;
exports.createFiles = createFiles;
exports.getAllFilesFroms3 = getAllFilesFroms3;
exports.removeLocalRepo = removeLocalRepo;
exports.checkRepoSize = checkRepoSize;
exports.checkIfPresent = checkIfPresent;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const client_s3_1 = require("@aws-sdk/client-s3");
const path_1 = __importDefault(require("path"));
const path_2 = require("path");
const child_process_1 = require("child_process");
const util_1 = require("util");
const utils_1 = require("./utils");
const https_1 = __importDefault(require("https"));
let execAsync = (0, util_1.promisify)(child_process_1.exec);
function createS3Client() {
    const clientOptions = {
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    };
    // Check if a proxy is defined
    if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
        console.log("https proxy ", process.env.HTTPS_PROXY);
        console.log("http proxy ", process.env.HTTP_PROXY);
        const proxyAgent = new https_1.default.Agent(Object.assign(Object.assign({}, https_1.default.globalAgent.options), { proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY }));
        // clientOptions.requestHandler = new NodeHttpHandler({
        //     httpAgent: proxyAgent,
        //     httpsAgent: proxyAgent,
        // });
    }
    //   return new S3Client(clientOptions);
}
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    console.log("proxy is present");
    console.log("https proxy ", process.env.HTTPS_PROXY);
    console.log("http proxy ", process.env.HTTP_PROXY);
}
const s3Client = new client_s3_1.S3Client({
    region: process.env.REGION,
    endpoint: process.env.ENDPOINT,
    credentials: {
        secretAccessKey: (_a = process.env.SECERET_ACCESS_KEY) !== null && _a !== void 0 ? _a : '',
        accessKeyId: (_b = process.env.ACCESS_KEY_ID) !== null && _b !== void 0 ? _b : ''
    },
    requestHandler: {
        timeout: 100000
    }
});
function getAllFiles(folderPath) {
    let response = [];
    let allFilesAndFolders = fs_1.default.readdirSync(folderPath);
    allFilesAndFolders.map((file) => {
        const fullFilePath = path_1.default.join(folderPath, file);
        if (fs_1.default.statSync(fullFilePath).isDirectory()) {
            response = response.concat(getAllFiles(fullFilePath));
        }
        else {
            response.push(fullFilePath);
        }
    });
    return response;
}
function uploadFolderTos3(s3filePath, localFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        let fileData;
        try {
            console.log("uploadfoldertos3 path ", s3filePath, localFilePath);
            if (!fs_1.default.existsSync(localFilePath)) {
                throw new Error(`File not found: ${localFilePath}`);
            }
            fileData = fs_1.default.readFileSync(localFilePath);
            console.log("file data read success");
            yield s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: process.env.BUCKET,
                Key: s3filePath,
                Body: fileData,
            }));
            console.log("folder uploaded to ", s3filePath);
        }
        catch (err) {
            console.error("error ", err);
        }
    });
}
function createFiles(path, data) {
    let filePath = path !== null && path !== void 0 ? path : "output";
    let dirPath = (0, path_2.dirname)(filePath);
    if (!fs_1.default.existsSync(dirPath)) {
        fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
    fs_1.default.writeFileSync(path !== null && path !== void 0 ? path : "./output", data);
}
function getAllFilesFroms3(path) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            console.log("getting all files from s3");
            console.log("path: ", path);
            const command = new client_s3_1.ListObjectsV2Command({
                Bucket: process.env.BUCKET,
                Prefix: path,
            });
            let response = yield s3Client.send(command);
            let pathsArr = (_a = response.Contents) === null || _a === void 0 ? void 0 : _a.map((entry) => entry.Key); //[file,file]
            //TODO: go through pathsArr and get every file in output folder
            if (!pathsArr)
                return;
            console.log("got paths array ", pathsArr.length);
            let filesPromises = pathsArr === null || pathsArr === void 0 ? void 0 : pathsArr.map((path) => __awaiter(this, void 0, void 0, function* () {
                if (path === null || path === undefined) {
                    console.error("path is null");
                    return;
                }
                const { Body } = yield s3Client.send(new client_s3_1.GetObjectCommand({
                    Bucket: "first-v",
                    Key: path,
                }));
                if (Body) {
                    const data = yield (0, utils_1.streamToString)(Body);
                    //TODO: based on the "path" and "data" create folder in output
                    createFiles(path, data);
                }
            }));
            yield Promise.all(filesPromises);
        }
        catch (err) {
            console.error("error getallfilesfroms3: ", err);
        }
    });
}
function removeLocalRepo(pth, id) {
    console.log("remove local repo");
    // console.log("path ",pth);
    let fullPath = path_1.default.join(pth, id);
    execAsync(`rm -r ${fullPath}`);
    // console.log("id ",id);
}
function checkRepoSize(repoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Sending request for repo cloinig");
            let [owner, repo] = repoUrl.split("/").slice(-2);
            repo = repo.split(".")[0];
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
            let response = yield axios_1.default.get(apiUrl);
            console.log("request successful ", response);
            console.log("response headers");
            console.log(response.headers['x-ratelimit-limit']); // Total requests allowed
            console.log(response.headers['x-ratelimit-remaining']); // Remaining requests
            console.log(response.headers['x-ratelimit-reset']);
            let size = response.data.size;
            // console.log("repo size: ",size);
            if (size >= 100000) {
                return false;
            }
        }
        catch (err) {
            console.error("Error repo cloning : ", err);
            return false;
        }
        return true;
    });
}
function checkIfPresent(buildPath) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("checking if file present");
        try {
            yield fs_1.default.promises.access(buildPath);
            return true;
        }
        catch (err) {
            console.log("file does not exist");
            return false;
        }
    });
}
