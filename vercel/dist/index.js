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
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("@upstash/redis");
const express_1 = __importDefault(require("express"));
// import {Readable} from 'stream';
require("dotenv/config");
// import fs from 'fs';
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const simple_git_1 = __importDefault(require("simple-git"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const file_1 = require("./file");
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
app.set("trust proxy", 1);
// app.use(cors({ origin: ['https://vrcl-frontend.vercel.app','http://localhost:5173','http://34.29.188.169'] }));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
let port = 3000;
const redis = new redis_1.Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN
});
let queueName = "vercelque";
//redis.lpush(queueName,"ycwm2");
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
    var _a;
    console.log("/deploy hit:");
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
    //START WORKER 
    try {
        axios_1.default.get((_a = process.env.WORKER_ENDPOINT) !== null && _a !== void 0 ? _a : "", { timeout: 50000 });
    }
    catch (err) {
        console.error("backend worker failed: ", err);
        yield redis.hset(id, { status: "Failed" });
        return res.send({ success: false, error: "Backend down" });
    }
    //TODO: clone FILE DATA AND PUT FILE IN S3 BUCKET WITH DTA
    let outputRoute = process.env.OUTPUT_ROUTE || "output/";
    let repoRoute = process.env.REPO_ROUTE || "repos/";
    let allFiles = (0, file_1.getAllFiles)(path_1.default.join(__dirname, outputRoute, id, "/")); //[localpath,localpathh,path]
    let allFilesPromises = allFiles.map((filePath) => __awaiter(void 0, void 0, void 0, function* () {
        let repoFolderPath = repoRoute;
        let absPathLength = path_1.default.join(__dirname, outputRoute).length;
        repoFolderPath = path_1.default.join(repoFolderPath, filePath.slice(absPathLength));
        console.log("uploading to ", repoFolderPath, filePath);
        return (0, file_1.uploadFolderTos3)(repoFolderPath, filePath);
    }));
    try {
        yield Promise.all(allFilesPromises);
        console.log("upload to s3 complete ");
    }
    catch (err) {
        console.error("promise failed ", err);
    }
    //TODO: remove repo present locally
    // let repoPath = process.cwd();
    let repoPath = path_1.default.resolve(__dirname, outputRoute);
    (0, file_1.removeLocalRepo)(repoPath, id);
    //push id in redis queue
    console.log("pushing id to redis");
    yield redis.lpush(queueName, id);
    //TODO: redis, set status of id to "building"
    yield redis.hset(id, { status: "building" });
    res.json({
        id: id
    });
}));
app.get("/status", verifyToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let id = req.query.id;
    console.log("hit status with id: ", id);
    //:get status from redis and send it back
    let statusResponse = yield redis.hget(id, "status");
    res.json({ status: statusResponse });
}));
app.get("/deployment", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("/deployment hit");
    let id = req.query.id;
    let buildFolder = path_1.default.join(__dirname, "../", (_a = process.env.BULID_ROUTE) !== null && _a !== void 0 ? _a : "null", id);
    let buildPath = path_1.default.join((_b = process.env.BULID_ROUTE) !== null && _b !== void 0 ? _b : "null", id);
    app.use(express_1.default.static(buildFolder));
    //TODO: check if already present
    if (yield (0, file_1.checkIfPresent)(buildPath)) {
        console.log("build already present");
        res.set("Content-Type", "text/html");
        return res.sendFile(path_1.default.join(buildFolder, `index.html`));
    }
    //TODO: get build from s3
    yield (0, file_1.getAllFilesFroms3)(buildPath);
    //TODO: send it back with correct header 
    res.set("Content-Type", "text/html");
    res.sendFile(path_1.default.join(buildFolder, `index.html`));
}));
app.get("/token", limiter, (req, res) => {
    if (!process.env.SECERET_PHRASE) {
        throw new Error('seceret passphrase not defined');
    }
    let userId = (0, uuid_1.v4)();
    let token = jsonwebtoken_1.default.sign({ userId }, process.env.SECERET_PHRASE);
    res.json({ token });
});
// app.post("/checkToken",(req,res)=>{
//     if(!process.env.SECERET_PHRASE){
//         throw new Error('seceret passphrase not defined');
//     }
//     let token = req.body.token;
//     let decoded = jwt.verify(token,process.env.SECERET_PHRASE);
// })
app.listen(port, () => {
    console.log("app listening on port ", port);
});
