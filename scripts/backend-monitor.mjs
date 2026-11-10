import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../public/account/config.json',import.meta.url),'utf8'));
const base=process.env.RUNTURF_MONITOR_URL||`${config.supabaseUrl}/functions/v1/runturf`;
if(new URL(base).protocol!=='https:')throw new Error('An HTTPS backend URL is required.');
for(const path of ['/health','/ready']){
  let healthy=false;
  for(let attempt=0;attempt<3;attempt++){
    const started=Date.now();
    try{const response=await fetch(base+path,{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(10000)});const body=await response.json();
      healthy=response.ok&&body.ok===true&&(path!=='/ready'||body.database===true);
      console.log(JSON.stringify({path,status:response.status,healthy,latencyMs:Date.now()-started}));
    }catch{console.log(JSON.stringify({path,healthy:false,error:'request_failed'}));}
    if(healthy)break;
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!healthy)throw new Error(`${path} failed three consecutive checks. Inspect Supabase logs using request IDs.`);
}
