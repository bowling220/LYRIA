/* Credentials are fetched once per session window, with a deadline and no microphone side effects. */
(() => {
  let cached,inFlight;
  const valid=servers=>Array.isArray(servers) && servers.length>0 && servers.length<=20 && servers.every(s=>s && (Array.isArray(s.urls)?s.urls:[s.urls]).every(url=>typeof url==='string' && /^(stun|turn|turns):[^\s]+$/.test(url)));
  const hasRelay=servers=>servers.some(s=>(Array.isArray(s.urls)?s.urls:[s.urls]).some(url=>/^turns?:/.test(url)));
  async function get(){
    const config=window.LYRIA_VOICE_CONFIG || {};
    if(!config.credentialsUrl){const servers=config.iceServers || [{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}];if(!valid(servers))throw new Error('The voice server configuration is invalid.');return {iceServers:servers,relay:hasRelay(servers)}}
    if(cached && cached.until>Date.now())return cached.value;if(inFlight)return inFlight;
    inFlight=(async()=>{
      const url=new URL(config.credentialsUrl,location.href);if(url.protocol!=='https:' && url.origin!==location.origin)throw new Error('The voice credentials endpoint must use HTTPS.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        const headers={};if(config.credentialsAuth){const user=window.firebaseConfig.getAuth().currentUser;if(!user)throw new Error('Sign in before joining voice.');headers.Authorization='Bearer '+await Promise.race([user.getIdToken(),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Voice credentials timed out.')),{once:true}))])}
        const response=await fetch(url,{signal:controller.signal,cache:'no-store',headers});if(!response.ok)throw new Error('The voice relay is unavailable. Please retry shortly.');
        const body=await response.json(),servers=Array.isArray(body)?body:body.iceServers;
        if(!valid(servers) || !hasRelay(servers))throw new Error('The voice service did not return a working relay configuration.');
        const value={iceServers:servers,relay:true};cached={value,until:Date.now()+240000};return value;
      }catch(error){if(error.name==='AbortError')throw new Error('The voice relay took too long to respond. Please retry.');throw error}
      finally{clearTimeout(timer)}
    })().finally(()=>inFlight=null);return inFlight;
  }
  async function probe(){
    const config=await get();if(!config.relay)return {relay:false,ready:false};
    if(typeof RTCPeerConnection!=='function')throw new Error('This browser does not support voice connections.');
    const pc=new RTCPeerConnection({iceServers:config.iceServers,iceTransportPolicy:'relay'});let timer;
    try{return await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(new Error('A relay connection could not be verified. Check your network and try again.')),10000);
      pc.addEventListener('icecandidate',event=>{if(event.candidate && (event.candidate.type==='relay' || / typ relay /.test(event.candidate.candidate)))resolve({relay:true,ready:true})});
      pc.createDataChannel('lyria-check');pc.createOffer().then(offer=>pc.setLocalDescription(offer)).catch(reject);
    })}finally{clearTimeout(timer);pc.close()}
  }
  window.LyriaVoiceTransport={get,probe,clear:()=>{cached=null}};
})();
