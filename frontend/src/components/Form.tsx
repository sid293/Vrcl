import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const backendUrl = import.meta.env.VITE_BACKEND;

export default function Form({setDeployments}: {setDeployments: ((deployments: string[])=> void)}){
    let [repoLink, setRepoLink] = useState("");
    let [id, setId] = useState("");
    let [status,setStatus] = useState("Ready");
    let [isButtonDisabled, setIsButtonDisabled] = useState(false);

    let getDeployedLink = async (pid: string)=>{
        // let response = await axios.get(backendUrl+`status?id=${id}`);
        let deploymentLink = `${backendUrl}deployment?id=${pid}`;
        console.log("deployment link ",deploymentLink);
        return deploymentLink;
    }

    let handleDeploy = async()=>{
        if(!sessionStorage.getItem("token")){
            return;
        }
        console.log("repo link is ",repoLink);
        let data = {repoUrl:repoLink};
        console.log("url is ",backendUrl);
        let token = sessionStorage.getItem("token");
        try {
            let response = await axios.post(backendUrl + "deploy", data, {
                headers:{
                    Authentication:`Bearer ${token}`
                }
            });
            console.log("backend response ", response);
            setId(response.data.id);
            // pid = response.data.id;
        } catch (err) {
            console.error("err: ",err);
        }
        //TODO: implement polling here
        // console.log("pid is ",pid);
        // pollingStatus(pid);
    }



    let pollingStatus = async ()=>{
        // if(!pid){
        //     console.log("id not ");
        //     return;
        // }
        // setStatus("start");
        // while(status !== "deployed"){
            // console.log("polling");
        let token = sessionStorage.getItem("token");
        let response = await axios.get(backendUrl + `status?id=${id}`, {
            headers: {
                Authentication: `Bearer ${token}`
            }
        });
            console.log("status is ",status);
            console.log("response is ",response.data.status);
            // if(status !== response.data.status){
                //why not getting set
        await new Promise(resolve => setTimeout(resolve,3000));
        let responseStatus = response.data.status;
        // let postDots = "..."; maybe implement this way
        console.log("response status ",responseStatus);
        if(responseStatus === "building"){
            if (status === "building...") {
                responseStatus = "building..";
            } else{
                responseStatus = "building...";
            }
        }
    setStatus(responseStatus);
        // }
        //TODO: get deployed link if success
    }

    useEffect(()=>{
        let deploymentsArr: string[] = JSON.parse(sessionStorage.getItem("deployments") ?? "[]");
        if (deploymentsArr.length === 3) {
            setIsButtonDisabled(true);
        }
    },[])

    useEffect(()=>{
        if(!id){
            return;
        }
        setIsButtonDisabled(true);
        console.log("use effect running");
        console.log("status is ",status);
        if(status !== "deployed"){
            pollingStatus();
        } else {
            (async() => {
                console.log("status is deployed");
                toast.success("Deployed",{position:"bottom-left", autoClose:1000});
                let deploymentsArr: string[] = JSON.parse(sessionStorage.getItem("deployments") ?? "[]");
                let deploymentLink = await getDeployedLink(id);
                if(!deploymentsArr.includes(deploymentLink)){
                    deploymentsArr.push(deploymentLink);
                }
                sessionStorage.setItem("deployments", JSON.stringify(deploymentsArr));
                //TODO: show this deployment link to frontend, array modification
                setDeployments(deploymentsArr);
                setId("");
                setStatus("Ready");
                if(deploymentsArr.length >= 3){
                    setIsButtonDisabled(true);
                    toast.warn("Limit reached",{position:"bottom-left", autoClose:1000});
                    return;
                }
                setIsButtonDisabled(false);
            })()
        }
        if(status === "failed"){
            setIsButtonDisabled(false);
            toast.error("Failed",{position:"bottom-left", autoClose:1000});
        }
    },[id,status])

    return(
        <div className="
        md:basis-2/5 
        md:h-3/5 
        basis-full 
        flex
        flex-col
        gap-9
        justify-start
        bg-zinc-800 
        shadow-xl 
        shadow-black
        rounded-lg">
            <div className="bg-zinc-900	h-12 text-4xl font-semibold rounded-tr-lg rounded-tl-lg">Repository link</div>
            <div>{status}</div>
            <div>
                <input onChange={(e)=>{setRepoLink(e.target.value)}} value={repoLink} placeholder="Enter github link" className={`px-3 h-10 w-60 border-4 rounded-lg ${status !== "Ready"?"border-blue-500  animate-pulse":""} `} />
            </div>
            <div>
                <button disabled={isButtonDisabled} className="disabled:bg-slate-400" onClick={() => handleDeploy()}>
                    Deploy
                </button>
                {/* <button disabled={isButtonDisabled} className={`${isButtonDisabled?"bg-slate-400":""}`} onClick={()=>handleDeploy()}>Deploy</button> */}
            </div>
        </div>
    )
}