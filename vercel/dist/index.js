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
// import {Client} from "@upstash/qstash";
const redis_1 = require("@upstash/redis");
const express_1 = __importDefault(require("express"));
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const simple_git_1 = __importDefault(require("simple-git"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const file_1 = require("./file");
const client_s3_1 = require("@aws-sdk/client-s3");
const child_process_1 = require("child_process");
const util_1 = require("util");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const express_rate_limit_1 = require("express-rate-limit");
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false
});
let execAsync = (0, util_1.promisify)(child_process_1.exec);
let app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, cors_1.default)({ origin: 'https://vrcl-frontend.vercel.app' }));
app.use(express_1.default.json());
let port = 3000;
const redis = new redis_1.Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN
});
let queueName = "vercelque";
// const s3Client = new S3Client({
//     region:"eu-central",
//     endpoint:"https://s3.eu-central-003.backblazeb2.com",
//     credentials:{
//         secretAccessKey:"K003nsWKvSQdr4QrWmFA4Y0mZTdw/uE", 
//         accessKeyId:"0035fb03ac09cc80000000001"
//     }
// });
const s3Client = new client_s3_1.S3Client({
    region: process.env.REGION,
    endpoint: process.env.ENDPOINT,
    credentials: {
        secretAccessKey: (_a = process.env.SECERET_ACCESS_KEY) !== null && _a !== void 0 ? _a : '',
        accessKeyId: (_b = process.env.ACCESS_KEY_ID) !== null && _b !== void 0 ? _b : ''
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
function verifyToken(req, res, next) {
    try {
        if (!process.env.SECERET_PHRASE) {
            throw new Error('seceret passphrase not defined');
        }
        let token = req.headers.authentication;
        token = token.split(' ')[1];
        let decoded = jsonwebtoken_1.default.verify(token, process.env.SECERET_PHRASE);
        if (decoded) {
            // return true;
            next();
        }
    }
    catch (err) {
        console.error("Error: ", err);
        // return false;
        res.status(400).json({ success: false, message: "Unauthorized" });
    }
}
//should put it in r2 and put in queue redis 
app.post("/deploy", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("/deploy hit");
    const repoUrl = req.body.repoUrl;
    let id = (0, utils_1.generate)();
    //TODO: redis, set status of id to cloning
    yield redis.hset(id, { status: "cloning" });
    // let repoSize = await checkRepoSize(repoUrl);  get this working
    let repoSize = true;
    if (!repoSize) {
        // throw new Error("The repo is too big");
        return res.send({ success: false, error: "Repo is too big." });
    }
    try {
        yield (0, simple_git_1.default)().clone(repoUrl, `dist/output/${id}`);
    }
    catch (err) {
        console.error("Error: Git clone failed");
        return res.send({ success: false, error: "Git clone failed" });
    }
    // return;
    //TODO: GET FILE DATA AND PUT FILE IN S3 BUCKET WITH DTA
    let allFiles = (0, file_1.getAllFiles)(path_1.default.join(__dirname, `output/${id}/`)); //[localpath,localpathh,path]
    // console.log("allfiles ",allFiles);
    allFiles.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        let repoFolderPath = `repos/`;
        let absPathLength = path_1.default.join(__dirname, "output/").length;
        repoFolderPath = path_1.default.join(repoFolderPath, filePath.slice(absPathLength));
        console.log("uploading to ", repoFolderPath, filePath);
        yield (0, file_1.uploadFolderTos3)(repoFolderPath, filePath);
    }));
    console.log("upload complete ");
    //TODO: remove repo present locally
    // let repoPath = process.cwd();
    let repoPath = path_1.default.resolve(__dirname, "output");
    (0, file_1.removeLocalRepo)(repoPath, id);
    //push id in redis queue
    console.log("pushing to redis");
    yield redis.lpush(queueName, id);
    //TODO: redis, set status of id to "building"
    yield redis.hset(id, { status: "building" });
    //TODO: delete output folder
    //change dir to output 
    // process.chdir();
    //remove everything from it - rm -r *
    // await execAsync("rm -r *");
    res.json({
        id: id
    });
}));
app.get("/status", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let id = req.query.id;
    console.log("hit status with id ", id);
    //TODO: get status from redis and send it back
    let statusResponse = yield redis.hget(id, "status");
    res.json({ status: statusResponse });
}));
app.get("/deployment", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("/deployment hit");
    let id = req.query.id;
    let buildFolder = path_1.default.join(__dirname, `../builds/${id}`);
    let buildPath = `builds/${id}`;
    //TODO: check if already present
    if (yield (0, file_1.checkIfPresent)(buildPath)) {
        res.set("Content-Type", "text/html");
        res.sendFile(path_1.default.join(buildFolder, `index.html`));
    }
    //TODO: get build from s3
    yield (0, file_1.getAllFilesFroms3)(buildPath);
    //TODO: send it back with correct header 
    app.use(express_1.default.static(buildFolder));
    res.set("Content-Type", "text/html");
    res.sendFile(path_1.default.join(buildFolder, `index.html`));
    // res.send("done");
}));
app.get("/token", limiter, (req, res) => {
    if (!process.env.SECERET_PHRASE) {
        throw new Error('seceret passphrase not defined');
    }
    let userId = (0, uuid_1.v4)();
    let token = jsonwebtoken_1.default.sign({ userId }, process.env.SECERET_PHRASE);
    res.json({ token });
});
app.post("/checkToken", (req, res) => {
    if (!process.env.SECERET_PHRASE) {
        throw new Error('seceret passphrase not defined');
    }
    let token = req.body.token;
    let decoded = jsonwebtoken_1.default.verify(token, process.env.SECERET_PHRASE);
    console.log("decoded and ", decoded);
});
app.listen(port, () => {
    console.log("app listening on port ", port);
});
