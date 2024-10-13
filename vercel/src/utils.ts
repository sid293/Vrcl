
export function generate(){
    const subset = "123456789qwertyuiopasdfghjklzxcvbnm";
    let length = 5;
    let id = "";
    for(let i=0;i<length;i++){
        id+=subset[Math.floor(Math.random() * subset.length)];
    }
    return id;
}


export function streamToString(stream: NodeJS.ReadableStream): Promise<string>{
    const chunks: Uint8Array[] = [];
    return new Promise((resolve,reject)=>{
        stream.on("data",(chunk)=> chunks.push(chunk));
        stream.on("error",(err)=> reject(err));
        stream.on("end",()=> resolve(Buffer.concat(chunks).toString("utf8")));
    })
}