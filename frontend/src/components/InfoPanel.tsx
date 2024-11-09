import {Dispatch, SetStateAction } from "react";
import { toast} from 'react-toastify';

export default function InfoPanel({show, setShow}:{show:boolean, setShow: Dispatch<SetStateAction<boolean>>}){

    let handleBack = ()=>{
        setShow(false);
    }

    let copyToClipboard = async(e: string)=>{
        await navigator.clipboard.writeText(e);
        toast.success("Copied",{position:"bottom-left", autoClose:300});
    }

    return(<div style={{
        position:"absolute",
        right:"0",
        overflow:"hidden",
        height:"100vh",
        width:show?"40vw":"0px",
        transition:"1s ease", 
        opacity:show?1 : 0,
        backgroundColor:"black"
        }}>
        <div>
            <p className="font-bold">Info</p> 
            <button className="absolute inset-y-0 left-0" onClick={handleBack}>X</button>
        </div>
        <div>
            <p className="text-center">
            <br/>
            <span className="font-bold">Sample Github repos:</span><br/>
            <a href="#" onClick={()=>{copyToClipboard("https://github.com/sid293/vite-sample.git")}}>https://github.com/sid293/vite-sample.git</a><br/>
            <a href="#" onClick={()=>{copyToClipboard("https://github.com/sid293/xspellcheck.git")}}>https://github.com/sid293/xspellcheck.git</a><br/>
            <a href="#" onClick={()=>{copyToClipboard("https://github.com/sid293/xcountries.git")}}>https://github.com/sid293/xcountries.git</a><br/>
            <br/>
            <a href="https://yummy-chestnut-7db.notion.site/VRCL-Architecture-1369a119068c80eb845ac6a400315766" target="blank">
            Architecture
            {/* <img src="../../public/new-tab.png" alt="new tab" style={{
                backgroundColor:"white",
                width:"20px",
                height:"20px",
                }}/> */}
            </a>
            </p>
        </div>
    </div>)
}