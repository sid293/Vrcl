import {Dispatch, SetStateAction } from "react";

export default function Navbar({setShow}:{setShow: Dispatch<SetStateAction<boolean>>}){
    function handleInfo(){
        console.log("? clicked");
        setShow(true);
    }

    return(
        <div className="flex justify-between">
            <h1 className='text-4xl px-4 tracking-wide uppercase font-extrabold'>Vrcl</h1>
            <button className="" onClick={handleInfo}><span className="font-extrabold">Info</span></button>
        </div>
    )
}