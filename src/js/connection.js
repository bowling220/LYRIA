/* Shared connection feedback and recovery. Never resumes a microphone automatically. */
(() => {
  const states=new Map(),timers=new Map(),completed=new Set();let retryHandler,busy=false,lastRetry=0,autoRetryTimer,revision=0,paintTimer,recoveredUntil=0,hadFailure=false;
  function markRecovered(){if(hadFailure && navigator.onLine && !states.size && !busy){hadFailure=false;recoveredUntil=Date.now()+4000;clearTimeout(paintTimer);paintTimer=setTimeout(render,4001)}}
  function render(){
    window.dispatchEvent(new Event('lyria:connection-state'));
    const panel=document.getElementById('connection-notice');if(!panel)return;
    const failed=[...states.values()].find(value=>value.error);
    const pending=[...states.values()].some(value=>Date.now()-(value.started || Date.now())>=500);
    if(failed || !navigator.onLine)hadFailure=true;
    const recovered=recoveredUntil>Date.now() && !states.size && !hadFailure,waiting=hadFailure && navigator.onLine && !failed && !busy;
    panel.hidden=navigator.onLine && !failed && !busy && !pending && !recovered && !waiting;
    panel.dataset.state=!navigator.onLine?'offline':failed?'error':busy?'reconnecting':pending || waiting?'connecting':'connected';
    const text=document.getElementById('connection-message'),button=document.getElementById('retry-connection');
    text.textContent=!navigator.onLine?'You’re offline. Reconnect to keep chatting.':busy?'Reconnecting to LYRIA…':failed?.message || (pending?'Connecting to LYRIA… Your drafts stay here.':recovered?'Reconnected. You’re ready to chat.':waiting?'Waiting for LYRIA. Your drafts stay here.':'');
    button.hidden=!failed && !busy && !waiting;button.disabled=busy || !navigator.onLine;button.textContent=states.has('assets')?'Reload LYRIA':'Reconnect';
  }
  function pending(part){
    completed.delete(part);
    clearTimeout(timers.get(part));states.set(part,{error:false,revision:++revision,started:Date.now()});
    setTimeout(render,510);
    timers.set(part,setTimeout(()=>{states.set(part,{...states.get(part),error:true,message:'LYRIA is taking too long to connect. Your drafts are still here. Try reconnecting.'});render()},12000));render();
  }
  function ready(part){clearTimeout(timers.get(part));timers.delete(part);states.delete(part);completed.add(part);markRecovered();render()}
  function fail(part,message){clearTimeout(timers.get(part));timers.delete(part);states.set(part,{revision:states.get(part)?.revision || ++revision,error:true,message});render()}
  async function retry(automatic=false){
    if(!navigator.onLine)return;
    if(automatic && (busy || Date.now()-lastRetry<3000)){
      clearTimeout(autoRetryTimer);autoRetryTimer=setTimeout(()=>retry(true),busy?1000:3000-(Date.now()-lastRetry));return;
    }
    if(busy)return;clearTimeout(autoRetryTimer);
    if(!retryHandler || states.has('assets')){if(!automatic)location.reload();return;}
    busy=true;lastRetry=Date.now();window.dispatchEvent(new Event('lyria:retry'));render();let timer;
    try{await Promise.race([retryHandler(),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Connection timed out')),12000))])}
    catch(error){console.warn('Connection recovery failed',error);fail('recovery','Couldn’t reconnect. Check your connection and try again.')}
    finally{clearTimeout(timer);busy=false;markRecovered();render()}
  }
  window.addEventListener('error',event=>{
    const target=event.target;
    if(target?.tagName==='SCRIPT' && target.src)fail('assets','Part of LYRIA couldn’t load. Reload to try again.');
  },true);
  window.addEventListener('offline',render);
  window.addEventListener('online',()=>{render();retry(true)});
  window.addEventListener('pageshow',event=>{if(event.persisted)retry(true)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && [...states.values()].some(value=>value.error))retry(true)});
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('retry-connection')?.addEventListener('click',()=>retry());render()});
  window.LyriaConnection={pending,ready,fail,retry,snapshot:()=>({online:navigator.onLine,reconnecting:busy,parts:[...states].map(([part,state])=>({part,...state}))}),isReady:part=>completed.has(part),setRetry:handler=>{retryHandler=handler}};
  pending('startup');
})();
