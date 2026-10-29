from browser_executable import CHROMIUM
"""Two-account call invitation UI, ring audio and microphone cleanup; no production writes.
Voice transport is covered separately by voice-smoke.py; this test substitutes only
joining/presence and uses the production invitation controller and Web Audio cues.
"""
from pathlib import Path
import json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STORE={'users/alice':{'displayName':'Alice','friends':['bob']},'users/bob':{'displayName':'Bob','friends':['alice']}}
def backend(request):
 op=request['op'];uid=request['uid']
 if op=='read':return STORE.get(request['path'])
 if op=='query':return [{'id':key.split('/')[-1],'data':value} for key,value in STORE.items() if key.startswith(request['collection']+'/') and key.count('/')==request['collection'].count('/')+1 and value.get(request['field'])==request['value']]
 if op=='commit':
  for w in request['writes']:
   path=w.get('delete') or w['update']['name']
   if w.get('currentDocument',{}).get('exists') is False and path in STORE:raise RuntimeError('Already exists')
   if w.get('currentDocument',{}).get('exists') is True and path not in STORE:raise RuntimeError('Missing document')
   if 'delete' in w:STORE.pop(path,None);continue
   data=dict(STORE.get(path,{}));data.update(w['update'].get('fields',{}))
   for transform in w.get('updateTransforms',[]):data[transform['fieldPath']]=int(time.time()*1000)
   STORE[path]=data
  return {}
HTML='''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/theme.css"><body class="app-page"><button id="start">Call Bob</button><button id="unlock">Enable sound</button><script src="/fixture.js"></script><script src="/voiceCall.js"></script><script src="/mock-join.js"></script><script src="/js/call-invites.js"></script><script>start.onclick=()=>LyriaCalls.callFriend('bob','Bob');unlock.onclick=()=>LyriaVoice.enableSounds();</script></body>'''
FIXTURE=r'''
const uid=new URL(location.href).searchParams.get('user');window.__notices=[];window.__tones=[];
const NativeAudio=window.AudioContext;window.AudioContext=class extends NativeAudio{createOscillator(){const o=super.createOscillator(),start=o.start.bind(o);o.start=(...args)=>{__tones.push(o.frequency.value);return start(...args)};return o}};
window.LyriaUI={icon:()=>'',notify:message=>__notices.push(message)};
const user={uid,displayName:uid};const auth={currentUser:user,onAuthStateChanged:fn=>queueMicrotask(()=>fn(user))};
const db={collection:()=>({where:()=>({})})};window.firebaseConfig={initialize:async()=>{},getAuth:()=>auth,getFirestore:()=>db};
const revive=value=>{if(!value)return value;const copy={...value};for(const field of ['timestamp'])if(typeof copy[field]==='number'){const ms=copy[field];copy[field]={toMillis:()=>ms}}if(copy.voice){const ms=copy.voice.updatedAt;copy.voice={...copy.voice,updatedAt:{toMillis:()=>ms}}}return copy};
const doc=(id,value)=>({id,exists:!!value,data:()=>revive(value)});
window.LyriaDataAPI={name:path=>path,fields:v=>v,equal:(field,value)=>({field,value}),commit:writes=>__backend({op:'commit',uid,writes}),read:async path=>doc(path.split('/').at(-1),await __backend({op:'read',uid,path})),query:async(collection,{where})=>({docs:(await __backend({op:'query',uid,collection,...where})).map(d=>doc(d.id,d.data))}),watch:(ref,collection,options,next,error)=>{
 let stopped=false,last='';const read=async()=>{try{const value=await LyriaDataAPI.query(collection,options);const s=JSON.stringify(value.docs.map(d=>[d.id,d.data()]));if(!stopped && s!==last){last=s;next(value)}}catch(e){error(e)}};read();const timer=setInterval(read,100);return()=>{stopped=true;clearInterval(timer)};
}};
'''
MOCK=r'''
let active=null;const actual=LyriaVoice;window.__mic=[];
const prepare=()=>actual.prepare().then(stream=>{__mic.push(stream);return stream});
window.LyriaVoice={...actual,prepare,getSession:()=>active,join:(channel,room,label,prepared)=>{
 const id='v'+crypto.randomUUID().replaceAll('-','');active={id,room,channel,joining:true,connectedUserIds:[]};
 return prepared.then(async stream=>{if(!active || active.id!==id){stream.getTracks().forEach(t=>t.stop());return false}active={...active,stream,joining:false};await LyriaDataAPI.commit([{update:{name:'channels/'+room+'/typingStatus/'+uid,fields:{voice:{sessionId:id,updatedAt:Date.now()}}}}]);return true});
},leave:()=>{if(!active)return;const old=active;active=null;old.stream?.getTracks().forEach(t=>t.stop());LyriaDataAPI.commit([{delete:'channels/'+old.room+'/typingStatus/'+uid}]);window.dispatchEvent(new CustomEvent('lyria:voice-state',{detail:null}))}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
 def make(uid,width):
  context=browser.new_context(viewport={'width':width,'height':844},permissions=['microphone']);page=context.new_page();page.expose_function('__backend',backend)
  def route(r):
   if not r.request.url.startswith('http://localhost:8125/'):r.abort();return
   path=r.request.url.split('8125/')[1].split('?')[0]
   body=FIXTURE if path=='fixture.js' else MOCK if path=='mock-join.js' else (ROOT/path).read_text() if path and (ROOT/path).is_file() else HTML
   r.fulfill(body=body,content_type='text/css' if path.endswith('.css') else 'text/javascript' if path.endswith('.js') else 'text/html')
  page.route('**/*',route);page.goto('http://localhost:8125/?user='+uid);return page
 alice=make('alice',1440);bob=make('bob',390);errors=[]
 for page in [alice,bob]:page.on('pageerror',lambda e:errors.append(str(e)))
 bob.locator('#unlock').click()
 bob.evaluate("""()=>{const read=LyriaDataAPI.read;window.__releaseProfiles=[];LyriaDataAPI.read=path=>path==='users/bob' && !window.__profilesReleased?new Promise(resolve=>__releaseProfiles.push(async()=>resolve(await read(path)))):read(path)}""")
 alice.locator('#start').click()
 bob.wait_for_function('__releaseProfiles.length===1');bob.evaluate('LyriaCalls.refresh()');bob.wait_for_function('__releaseProfiles.length===2')
 bob.evaluate('window.__profilesReleased=true;__releaseProfiles.forEach(release=>release())')
 bob.wait_for_function("document.getElementById('call-invite-panel')?.hidden===false && document.getElementById('call-invite-title').textContent.includes('alice')")
 alice.wait_for_function('__tones.includes(440) && __tones.includes(480)')
 bob.wait_for_function('__tones.includes(620) && __tones.includes(780)')
 assert bob.evaluate('__mic.length')==0,'An incoming ring opened the microphone before Answer'
 box=bob.locator('#call-invite-panel').bounding_box();assert box['x']>=0 and box['x']+box['width']<=390 and box['y']+box['height']<=844
 bob.screenshot(path=str(ROOT/'test-artifacts/incoming-call-mobile.png'))
 bob.locator('#decline-call').click();alice.wait_for_function("document.getElementById('call-invite-status').textContent.includes('declined')")
 alice.wait_for_function("__mic.every(s=>s.getTracks().every(t=>t.readyState==='ended'))")
 # Answer: both sides join the same private room and stop ringing.
 alice.locator('#start').click();bob.locator('#answer-call').wait_for(state='visible')
 bob.locator('#answer-call').click();bob.wait_for_function("document.getElementById('call-invite-panel').hidden")
 alice.wait_for_function("document.getElementById('call-invite-panel').hidden")
 assert alice.evaluate('LyriaVoice.getSession().room')==bob.evaluate('LyriaVoice.getSession().room')
 assert bob.evaluate('__mic.at(-1).getAudioTracks()[0].readyState')=='live'
 assert any(v.get('type')=='callInvite' and v.get('status')=='accepted' for v in STORE.values())
 # Wait for the actual visible invitation: a hidden parent can retain the old Answer button state.
 # Explicit leave before another invitation; cancellation stops the caller's mic and recipient ring.
 alice.evaluate('LyriaVoice.leave()');bob.evaluate('LyriaVoice.leave()');alice.locator('#start').click()
 bob.locator('#answer-call').wait_for(state='visible')
 alice.locator('#cancel-call-invite').click();bob.wait_for_function("document.getElementById('call-invite-status').textContent.includes('Missed')")
 assert alice.evaluate('__mic.every(s=>s.getTracks().every(t=>t.readyState===\'ended\'))')
 # No gesture: the incoming UI still appears and offers an explicit audio unlock.
 bob.close();bob=make('bob',390);bob.on('pageerror',lambda e:errors.append(str(e)))
 alice.locator('#start').click();bob.locator('#answer-call').wait_for(state='visible')
 assert bob.locator('#enable-call-ring').is_visible()
 bob.locator('#enable-call-ring').click();bob.wait_for_function('__tones.includes(620)')
 bob.locator('#decline-call').click();alice.wait_for_function("document.getElementById('call-invite-status').textContent.includes('declined')")
 # Unanswered calls end locally and release the microphone.
 alice.clock.install();alice.locator('#start').click();bob.locator('#answer-call').wait_for(state='visible')
 alice.clock.fast_forward(46000)
 alice.wait_for_function("document.getElementById('call-invite-status').textContent.includes('No answer')")
 assert alice.evaluate('__mic.every(s=>s.getTracks().every(t=>t.readyState===\'ended\'))')
 assert not errors,errors
 browser.close()
print('PASS: two-account outgoing/incoming ring tones, explicit sound unlock, no microphone before Answer, accept into one private room, decline/cancel cleanup, and persisted invitation status.')
