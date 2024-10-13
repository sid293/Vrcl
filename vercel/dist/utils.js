"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
exports.streamToString = streamToString;
function generate() {
    const subset = "123456789qwertyuiopasdfghjklzxcvbnm";
    let length = 5;
    let id = "";
    for (let i = 0; i < length; i++) {
        id += subset[Math.floor(Math.random() * subset.length)];
    }
    return id;
}
function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}
