// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import Form from './components/Form';
import { useEffect, useState } from 'react';
import './App.css'
import Deployments from './components/Deployments';
import Navbar from './components/Navbar';
import axios from 'axios';
import 'react-toastify/dist/ReactToastify.css';
// import { toast, ToastContainer } from 'react-toastify';

function App() {
    let [deployments, setDeployments] = useState<string[]>([]);
    //TODO: GET TOKEN AND STORE IT IN SESSION STORAGE
    let getToken = async ()=>{
      console.log("getting token");
      let response = await axios.get(import.meta.env.VITE_BACKEND+"token");
      sessionStorage.setItem("token",response.data.token);
    }

    useEffect(()=>{
      getToken();
      let deploymentsArr: string[] = JSON.parse(sessionStorage.getItem("deployments") ?? "[]");
      if(deploymentsArr.length){
        setDeployments(deploymentsArr);
      }
    },[])

  return (
    <>
        <Navbar />
        <div className="flex flex-wrap items-center justify-around h-4/5 w-full">
          <Deployments deployments={deployments} />
          <Form setDeployments={setDeployments} />
          {/* <div className='grow'>01</div>
          <div className='grow'>02</div> */}
        </div>
    </>
  )
}

export default App
