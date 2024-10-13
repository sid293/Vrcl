
export function streamToString(stream: NodeJS.ReadableStream): Promise<string>{
    const chunks: Uint8Array[] = [];
    return new Promise((resolve,reject)=>{
        stream.on("data",(chunk)=> chunks.push(chunk));
        stream.on("error",(err)=> reject(err));
        stream.on("end",()=> resolve(Buffer.concat(chunks).toString("utf8")));
    })
}


export async function delay(time: number){
    return new Promise((resolve)=>{
        setTimeout(resolve, time);
    })
}