// import 'react-toastify/dist/ReactToastify.css';
import { toast, ToastContainer } from 'react-toastify';


export default function Deployments({deployments}: {deployments: string[]}){
    let links = [
        "http://google.com",
        "http://wikipedia.com",
        "http://yahoo.com"];
    links = deployments;

    // const options = {
    //     autoClose: 6000,
    //     hideProgressBar: false,
    //     position: "bottom-left",
    //     pauseOnHover: true,
    //     progress: 0.2,
    //     color:"blue"
    //     // and so on ...
    // };
    function handleClick(){
        console.log("hanlde click");
        // toast("default notification", {position:"bottom-left", autoClose:500});
        toast.success("Deployed",{position:"bottom-left", autoClose:1000});
        // toast.success("default notification", {...options, position:"bottom-left"});
        // toast.success("default notification");
    }

    return(
    <div className="
        md:basis-2/5 
        md:h-3/5 
        basis-full 
        flex
        flex-col
        bg-zinc-800 
        shadow-xl 
        shadow-black
        rounded-lg">
        <div className="bg-zinc-900	h-12 text-4xl font-semibold rounded-tr-lg rounded-tl-lg">Deployments</div>
        <div className="flex justify-center flex-col items-center">
            {links.map((link)=>
            <div className="
                bg-neutral-700 
                text-left 
                flex
                justify-between
                p-3
                h-12 
                rounded-lg 
                mt-3
                w-11/12
                shadow 
                shadow-green-500/40 
                hover:shadow-blue-500/40">
                    <p className="truncate text-nowrap">{link}</p>
                    <div className="flex gap-3 relative">
                        {/* <span className="absolute border-2 border-sky-500 bottom-7 left-5 rounded-lg bg-black">Copied</span> */}
                        <svg onClick={()=>{window.open(link,"_blank")}} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <svg onClick={() => {
                            navigator.clipboard.writeText(link);
                            handleClick();
                            // toast("Copied", { position: "bottom-left", autoClose: 500 });
                            }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                        </svg>
                    </div>
                </div>)}
            </div>
            <div className=''>
                <ToastContainer />
            </div>
    </div>)
}

