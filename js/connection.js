/* Shared connection feedback and recovery. Never resumes a microphone automatically. */
(() => {
  const states=new Map(),timers=new Map(),completed=new Set();let retryHandler,busy=false,lastRetry=0,autoRetryTimer;
  function render(){
    const panel=document.getElementById('connection-notice');if(!panel)return;
    const failed=[...states.values()].find(value=>value.error);
    panel.hidden=navigator.onLine && !failed && !busy;
    const text=document.getElementById('connection-message'),button=document.getElementById('retry-connection');
    text.textContent=!navigator.onLine?'You’re offline. Reconnect to keep chatting.':busy?'Reconnecting to LYRIA…':failed?.message || '';
    button.disabled=busy || !navigator.onLine;button.textContent=states.has('assets')?'Reload LYRIA':'Reconnect';
  }
  function pending(part){
    completed.delete(part);
    clearTimeout(timers.get(part));states.set(part,{error:false});
    timers.set(part,setTimeout(()=>{states.set(part,{error:true,message:'LYRIA is taking too long to connect. Your drafts are still here. Try reconnecting.'});render()},12000));render();
  }
  function ready(part){clearTimeout(timers.get(part));timers.delete(part);states.delete(part);completed.add(part);render();window.dispatchEvent(new Event('lyria:connection-state'))}
  function fail(part,message){clearTimeout(timers.get(part));timers.delete(part);states.set(part,{error:true,message});render()}
  async function retry(automatic=false){
    if(!navigator.onLine)return;
    if(automatic && (busy || Date.now()-lastRetry<3000)){
      clearTimeout(autoRetryTimer);autoRetryTimer=setTimeout(()=>retry(true),busy?1000:3000-(Date.now()-lastRetry));return;
    }
    if(busy)return;clearTimeout(autoRetryTimer);
    if(!retryHandler || states.has('assets')){if(!automatic)location.reload();return;}
    busy=true;lastRetry=Date.now();render();let timer;
    try{await Promise.race([retryHandler(),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Connection timed out')),12000))])}
    catch(error){console.warn('Connection recovery failed',error);fail('recovery','Couldn’t reconnect. Check your connection and try again.')}
    finally{clearTimeout(timer);busy=false;render()}
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
  window.LyriaConnection={pending,ready,fail,isReady:part=>completed.has(part),setRetry:handler=>{retryHandler=handler}};
  pending('startup');
})();
