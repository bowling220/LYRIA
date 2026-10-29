from browser_executable import CHROMIUM
"""Real two-browser WebRTC checks using a local PeerJS server and a room-presence fixture.
No production Firebase, microphone, signaling service, or TURN credentials are used.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from threading import Thread,Lock
import json, subprocess, socket, time, urllib.request, os, shutil
from voice_rpc_fixture import serve
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STATE={};LOCK=Lock()
PEER=urllib.request.urlopen('https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js',timeout=20).read()
with socket.socket() as sock:sock.bind(('127.0.0.1',0));SIGNAL_PORT=sock.getsockname()[1]
with socket.socket() as sock:sock.bind(('127.0.0.1',0));TURN_PORT=sock.getsockname()[1]
TURN_BINARY=os.environ.get('LYRIA_TEST_TURN_BINARY') or shutil.which('turnserver')
if not TURN_BINARY:raise RuntimeError('Install coturn or set LYRIA_TEST_TURN_BINARY to its turnserver executable.')
HTML='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body>
<h2 id="channel-title">Everyone</h2><ul id="voice-channels"></ul><p id="voice-directory-label"></p><p id="voice-directory-status"></p><label><input type="checkbox" id="voice-sound-effects" checked>Effects</label>
<button id="make-voice-call">Join voice</button><button id="end-call">Leave voice</button>
<section id="voice-panel" hidden><strong id="voice-room-name"></strong><p id="voice-status"></p><ul id="voice-participants"></ul><meter id="voice-mic-level" min="0" max="1"></meter><span id="voice-mic-status"></span><button id="voice-repair-mic" hidden>Reconnect microphone</button><button id="voice-mute">Mute</button><button id="voice-enable-sound" hidden>Enable sound</button><button id="voice-retry" hidden>Rejoin voice</button></section>
<script src="/fixture.js"></script><script src="/peer.js"></script><script>window.__peerObjects=[];const NativePeer=Peer;window.Peer=class extends NativePeer{constructor(...args){super(...args);__peerObjects.push(this)}};</script><script src="/js/data-api.js"></script><script src="/js/voice-presence.js"></script><script src="/js/voice-transport.js"></script><script src="/voiceCall.js"></script><script>LyriaVoice.setRoom('community');</script>'''
HOME=(ROOT/'home.html').read_text()
CALL_STAGE=HOME[HOME.index('            <section id="call-stage"'):HOME.index('            <p id="community-notice"')]
HTML=HTML.replace('<body>','<body><main class="chat-area">').replace('<button id="voice-mute">','<button id="voice-open-view">View call</button><button id="voice-mute">').replace('<script src="/fixture.js">',CALL_STAGE+'</main><script src="/fixture.js">').replace('<script>LyriaVoice.setRoom', '<script src="/js/voice-view.js"></script><script>LyriaVoice.setRoom')
FIXTURE=r'''
const uid=new URL(location.href).searchParams.get('user');window.__notices=[];window.__rtc=[];
const NativeRTC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativeRTC{constructor(...args){super(...args);window.__rtc.push(this)}};
window.__tones=[];const NativeAudio=window.AudioContext;window.AudioContext=class extends NativeAudio{createOscillator(){const o=super.createOscillator(),start=o.start.bind(o);o.start=(...args)=>{__tones.push(o.frequency.value);return start(...args)};return o}};
window.LyriaUI={icon:()=>'',notify:(message)=>__notices.push(message)};
window.LYRIA_VOICE_CONFIG={signaling:{host:'127.0.0.1',port:SIGNAL_PORT,path:'/voice',secure:false},iceServers:[{urls:'turn:127.0.0.1:TURN_PORT?transport=tcp',username:'fixture',credential:'local-only'}]};
window.__captures=0;const clone=MediaStream.prototype.clone;MediaStream.prototype.clone=function(){const stream=clone.call(this);window.__localStream=stream;return stream};
const mic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async options=>{window.__captures++;if(window.__failConstraints && options.audio!==true){window.__failConstraints=false;throw new DOMException('Unsupported constraint','OverconstrainedError')}if(window.__denyMic)throw new DOMException('Denied','NotAllowedError');const stream=await mic(options);window.__localStream=stream;return stream};
const nativePlay=HTMLMediaElement.prototype.play,nativePaused=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'paused').get;
HTMLMediaElement.prototype.play=function(){if(window.__blockSound && this.classList.contains('voice-remote-audio')){if(window.__allowSoundOnTap)window.__blockSound=false;else return Promise.reject(new DOMException('Tap required','NotAllowedError'));}return nativePlay.call(this)};
Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){if(window.__blockSound && this.classList.contains('voice-remote-audio'))return true;return nativePaused.call(this)}});
async function request(room,body){if(window.__blockCleanup && body?.expected)return new Promise(()=>{});const response=await fetch('/presence?room='+encodeURIComponent(room),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return response.json()}
const stamp=voice=>voice?{...voice,updatedAt:{toMillis:()=>voice.updatedAt}}:undefined;
function doc(id,value){return{id,exists:Boolean(value),data:()=>({...value,voice:stamp(value?.voice)})}}
class Ref{
 constructor(room,id){this.room=room;this.id=id}
 collection(){return this}
 doc(id){return new Ref(this.room,id)}
 async get(){const data=await request(this.room);return this.id?doc(this.id,data[this.id]):{forEach:fn=>Object.entries(data).forEach(([id,value])=>fn(doc(id,value)))}}
 async set(value){await request(this.room,{uid:this.id,patch:value})}
 async update(value){await request(this.room,{uid:this.id,patch:value})}
 onSnapshot(fn,error){if(window.__stallPresence)return()=>{};let active=true,busy=false;const read=async()=>{if(busy)return;busy=true;try{const snapshot=await this.get();if(active)fn(snapshot)}catch(e){if(active)error?.(e)}finally{busy=false}};read();const timer=setInterval(read,80);return()=>{active=false;clearInterval(timer)}}
}
const db={collection:()=>({doc:room=>new Ref(room)}),runTransaction:async work=>{
 let expected;const operations=[];await work({get:async ref=>{const result=await ref.get();expected=result.data().voice?.sessionId;return result},update:(ref,patch)=>operations.push(request(ref.room,{uid:ref.id,patch,expected}))});await Promise.all(operations)
}};
const fs=()=>db;fs.FieldValue={serverTimestamp:()=>({serverTime:true}),delete:()=>({deleteField:true})};
window.firebase={firestore:fs};window.firebaseConfig={getAuth:()=>({currentUser:{uid,displayName:uid,getIdToken:async()=>uid}}),getFirestore:()=>db,getApp:()=>({options:{projectId:'voice-fixture'}})};
const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>{if(String(url).startsWith('https://firestore.googleapis.com')){if(window.__blockCleanup && String(options?.body).includes('\"fieldPaths\":[\"voice\"]') && String(options.body).includes('\"fields\":{}'))return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));return originalFetch('/firestore'+new URL(url).pathname,options)}return originalFetch(url,options)};
'''.replace('SIGNAL_PORT',str(SIGNAL_PORT)).replace('TURN_PORT',str(TURN_PORT))
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  from urllib.parse import urlparse,parse_qs
  url=urlparse(self.path)
  if url.path.startswith('/firestore'):
   with LOCK:status,value=serve(url.path,None,STATE,time.time()*1000)
   self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode());return
  if url.path=='/presence':
   room=parse_qs(url.query)['room'][0]
   with LOCK:body=json.dumps(STATE.get(room,{})).encode()
   content='application/json'
  elif url.path=='/peer.js':body=PEER;content='text/javascript'
  elif url.path=='/fixture.js':body=FIXTURE.encode();content='text/javascript'
  elif url.path.startswith('/js/'):
   body=(ROOT/url.path.lstrip('/')).read_bytes();content='text/javascript'
  elif url.path=='/voiceCall.js':body=(ROOT/'voiceCall.js').read_bytes();content='text/javascript'
  else:body=HTML.encode();content='text/html'
  self.send_response(200);self.send_header('Content-Type',content);self.end_headers();self.wfile.write(body)
 def do_POST(self):
  from urllib.parse import urlparse,parse_qs
  if self.path.startswith('/firestore'):
   data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
   with LOCK:status,value=serve(self.path,data,STATE,time.time()*1000)
   self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode());return
  room=parse_qs(urlparse(self.path).query)['room'][0];data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  with LOCK:
   target=STATE.setdefault(room,{}).setdefault(data['uid'],{})
   if 'expected' not in data or target.get('voice',{}).get('sessionId')==data['expected']:
    for key,value in data['patch'].items():
     if key=='voice' and value.get('deleteField'):target.pop('voice',None)
     elif key=='voice':target['voice']={**value,'updatedAt':time.time()*1000}
     elif key=='voice.updatedAt' and target.get('voice'):target['voice']['updatedAt']=time.time()*1000
     elif key=='voice.muted' and target.get('voice'):target['voice']['muted']=value
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{}')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
turn_log=open(f'/tmp/lyria-test-turn-{TURN_PORT}.log','w+')
turn=subprocess.Popen([TURN_BINARY,'--listening-ip=127.0.0.1','--relay-ip=127.0.0.1',f'--listening-port={TURN_PORT}','--no-tls','--no-dtls','--no-cli','--allow-loopback-peers','--realm=lyria.test','--user=fixture:local-only','--lt-cred-mech','--fingerprint','--relay-threads=1',f'--pidfile=/tmp/lyria-test-turn-{TURN_PORT}.pid','--log-file=stdout'],stdout=turn_log,stderr=turn_log)
peer=subprocess.Popen(['node',str(ROOT/'tests/voice-server.cjs'),str(SIGNAL_PORT)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
try:
 for _ in range(60):
  try:
   with socket.create_connection(('127.0.0.1',SIGNAL_PORT),timeout=.2):break
  except OSError:time.sleep(.1)
 else:raise RuntimeError('Local PeerJS server did not start: '+peer.stderr.read().decode())
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  a=browser.new_context(permissions=['microphone']);b=browser.new_context(permissions=['microphone'])
  alice=a.new_page();bob=b.new_page();errors=[]
  for page in [alice,bob]:page.on('pageerror',lambda error:errors.append(str(error)))
  alice.goto(origin+'/?user=alice');bob.goto(origin+'/?user=bob');bob.evaluate('window.__blockSound=true')
  for page in [alice,bob]:page.evaluate('window.__stallPresence=true')

  alice.locator('#make-voice-call').click();bob.locator('#make-voice-call').click()
  for page in [alice,bob]:page.wait_for_function("document.querySelectorAll('.voice-remote-audio').length===1",timeout=25000)
  try:alice.wait_for_function("document.getElementById('voice-status').textContent.includes('Connected')",timeout=12000)
  except Exception:
   for page in [alice,bob]:print(page.evaluate("async()=>({status:document.getElementById('voice-status').textContent,pcs:await Promise.all(__rtc.map(async pc=>({connection:pc.connectionState,ice:pc.iceConnectionState,stats:[...(await pc.getStats()).values()].filter(s=>['candidate-pair','local-candidate','remote-candidate','inbound-rtp'].includes(s.type))})))})"))
   raise
  bob.wait_for_function("!document.getElementById('voice-enable-sound').hidden")
  bob.evaluate('window.__allowSoundOnTap=true');bob.locator('#voice-enable-sound').click()
  bob.wait_for_function("document.getElementById('voice-status').textContent.includes('Connected')")
  assert alice.evaluate("document.querySelector('audio').srcObject.getAudioTracks()[0].readyState")=='live'
  assert bob.evaluate("document.querySelector('audio').srcObject.getAudioTracks()[0].readyState")=='live'
  for page in [alice,bob]:page.wait_for_function("async()=>{for(const pc of __rtc){const stats=await pc.getStats();if([...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))return true}return false}",timeout=10000)
  assert alice.locator('audio').count()==1 and bob.locator('audio').count()==1,'Duplicate offers created duplicate audio'
  for page in [alice,bob]:
   page.wait_for_function("document.querySelectorAll('.call-person').length===2")
   assert page.locator('#call-stage').is_visible()
   page.wait_for_function("document.querySelector('.call-person[data-self=false]').classList.contains('is-speaking')",timeout=12000)
  session_before=alice.evaluate('LyriaVoice.getSession().id')
  alice.locator('#call-stage-sound').click();assert alice.evaluate("document.querySelector('audio').muted")
  assert alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  alice.locator('#call-stage-sound').click();assert not alice.evaluate("document.querySelector('audio').muted")
  alice.locator('#call-stage-chat').click();assert alice.locator('#call-stage').is_hidden()
  assert alice.evaluate('LyriaVoice.getSession().id')==session_before
  alice.locator('#voice-open-view').click();assert alice.locator('#call-stage').is_visible()
  alice.locator('#call-stage-mute').click();assert not alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  assert alice.locator('.call-person[data-self=true]').get_attribute('data-muted')=='true'
  assert not alice.locator('.call-person[data-self=true]').evaluate("el=>el.classList.contains('is-speaking')")
  alice.locator('#call-stage-mute').click()
  with LOCK:alice_peer=STATE['community']['alice']['voice']['peerId']
  bob.evaluate("""target=>new Promise(resolve=>{
    const rogue=new Peer('rogue-'+crypto.randomUUID(),{host:'127.0.0.1',port:SIGNAL_PORT,path:'/voice',secure:false,config:{iceServers:[]}});
    rogue.on('open',()=>{rogue.call(target,__localStream,{metadata:{roomId:'wrong-room',sessionId:'unknown'}});window.__roguePeer=rogue;resolve()});
  })""".replace('SIGNAL_PORT',str(SIGNAL_PORT)),alice_peer)
  alice.wait_for_timeout(300)
  assert alice.locator('audio').count()==1,'A call from another room was accepted'
  bob.evaluate('window.__roguePeer.destroy()')
  for page in [alice,bob]:assert page.evaluate("async()=>{for(const pc of __rtc){const stats=await pc.getStats();for(const pair of stats.values()){if(pair.type==='candidate-pair'&&pair.state==='succeeded'&&stats.get(pair.localCandidateId)?.candidateType==='relay')return true}}return false}"),'No relayed audio connection was verified'
  alice.wait_for_function("document.getElementById('voice-participants').textContent.includes('bob')")
  assert alice.locator('#voice-channels').inner_text().count('/6')==3
  alice.locator('#voice-mute').click();assert not alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  bob.wait_for_function("document.getElementById('voice-participants').textContent.includes('alice · muted')")
  assert alice.evaluate('__tones.includes(330) && __tones.includes(220)'), 'Mute sound missing'
  alice.locator('#voice-mute').click();assert alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  assert alice.evaluate('__tones.includes(550)'), 'Unmute sound missing'
  assert alice.evaluate('__tones.includes(660)'), 'Join sound missing'
  # Allowed permission: handoff reuses capture, repairs replace the sender without leaving the room.
  captures=alice.evaluate('__captures');session_id=alice.evaluate('LyriaVoice.getSession().id')
  alice.locator('#voice-mute').click()
  alice.evaluate("async()=>{const live=__localStream;const spare=await LyriaVoice.prepare();window.__handoffEnabled=spare.getAudioTracks()[0].enabled;spare.getTracks().forEach(t=>t.stop());window.__localStream=live}")
  assert alice.evaluate('__captures')==captures and alice.evaluate('__handoffEnabled')
  assert not alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  alice.locator('#voice-mute').click()
  alice.evaluate('__localStream.getAudioTracks()[0].stop()')
  alice.wait_for_function("!document.getElementById('voice-repair-mic').hidden")
  alice.locator('#voice-repair-mic').click()
  alice.wait_for_function("document.getElementById('voice-mic-status').textContent.includes('ready')")
  assert alice.evaluate('LyriaVoice.getSession().id')==session_id
  alice.wait_for_function("__rtc.some(pc=>pc.connectionState==='connected' && pc.getSenders().some(s=>s.track?.id===__localStream.getAudioTracks()[0].id))")
  alice.wait_for_function("document.getElementById('voice-mic-level').value>0.02")
  alice.evaluate("()=>{const track=__localStream.getAudioTracks()[0];Object.defineProperty(track,'muted',{get:()=>true});track.dispatchEvent(new Event('mute'))}")
  alice.wait_for_function("document.getElementById('voice-mic-status').textContent.includes('paused')")
  alice.evaluate("()=>{const sender=__rtc.find(p=>p.connectionState==='connected').getSenders().find(s=>s.track?.kind==='audio');sender.replaceTrack=async()=>{throw new Error('Simulated replacement failure')}}")
  alice.locator('#voice-repair-mic').click();alice.wait_for_function("document.getElementById('voice-mic-status').textContent.includes('ready')")
  for page in [alice,bob]:page.wait_for_function("document.getElementById('voice-status').textContent.includes('Connected')",timeout=35000)
  assert alice.evaluate('LyriaVoice.getSession().id')==session_id
  # Loss of signaling preserves the microphone and established media.
  captures=alice.evaluate('__captures')
  alice.evaluate("__peerObjects.find(p=>!p.destroyed && p.id?.startsWith('lyria-')).disconnect()")
  alice.wait_for_function("__peerObjects.some(p=>!p.destroyed && p.id?.startsWith('lyria-') && p.open)")
  assert alice.evaluate('__captures')==captures
  # A failed media leg is recreated; a verified newer offer replaces the stale leg on its peer.
  alice.evaluate("Object.values(__peerObjects.find(p=>!p.destroyed && p.id?.startsWith('lyria-')).connections).flat().find(c=>c.type==='media').close()")
  for page in [alice,bob]:page.wait_for_function("document.getElementById('voice-status').textContent.includes('Connected') && document.querySelectorAll('audio').length===1",timeout=35000)
  for page in [alice,bob]:page.wait_for_function("async()=>{for(const pc of __rtc.filter(p=>p.connectionState==='connected'))if([...(await pc.getStats()).values()].some(s=>s.type==='inbound-rtp' && s.bytesReceived>0))return true;return false}")
  alice.evaluate("LyriaVoice.setRoom('private-studio')")
  assert alice.evaluate('__localStream.getAudioTracks()[0].readyState')=='live', 'Browsing text disconnected voice'
  alice.locator('#end-call').click()
  assert alice.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended'
  assert alice.locator('audio').count()==0
  bob.wait_for_function("document.querySelectorAll('.voice-remote-audio').length===0")
  bob.locator('#end-call').click();assert bob.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended'
  bob.evaluate("LyriaVoice.setRoom('private-studio')")
  alice.locator('#voice-channels button').nth(1).click();bob.locator('#voice-channels button').nth(2).click()
  for page in [alice,bob]:page.wait_for_function("document.getElementById('voice-status').textContent.includes('Waiting')",timeout=25000)
  alice.wait_for_timeout(400)
  assert alice.locator('audio').count()==0 and bob.locator('audio').count()==0, 'Different voice channels were connected'
  assert 'Gaming' in alice.locator('#voice-room-name').inner_text()
  bob.locator('#voice-channels button').nth(1).click()
  for page in [alice,bob]:page.wait_for_function("document.querySelectorAll('.voice-remote-audio').length===1",timeout=25000)
  alice.wait_for_function("document.getElementById('voice-channels').textContent.includes('bob')")
  alice.locator('#voice-sound-effects').uncheck();tones=alice.evaluate('__tones.length')
  alice.locator('#voice-mute').click();alice.locator('#voice-mute').click()
  assert alice.evaluate('__tones.length')==tones, 'Disabled sound effects still played'
  assert alice.evaluate("localStorage.getItem('lyria-voice-sounds')")=='off'
  for page in [alice,bob]:page.wait_for_function("async()=>{for(const pc of __rtc.filter(pc=>pc.connectionState==='connected')){const stats=await pc.getStats();if([...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))return true}return false}",timeout=10000)
  alice.evaluate('window.__blockCleanup=true');alice.locator('#end-call').click();assert alice.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended';bob.locator('#end-call').click()
  alice.evaluate('window.__blockCleanup=false;window.__failConstraints=true');alice.locator('#make-voice-call').click();alice.wait_for_function("document.getElementById('voice-mic-status').textContent.includes('ready') && !LyriaVoice.getSession().joining");alice.locator('#end-call').click()
  alice.evaluate('window.__denyMic=true');alice.locator('#make-voice-call').click();alice.wait_for_function("__notices.some(text=>text.includes('Microphone access is blocked'))")
  assert alice.locator('#make-voice-call').is_enabled()
  alice.evaluate("""() => {
    window.__denyMic=false;window.__blockCleanup=false;
    const original=navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia=options=>new Promise(resolve=>{window.__releaseMic=async()=>resolve(await original(options))});
  }""")
  alice.locator('#make-voice-call').click();alice.locator('#end-call').click();alice.evaluate('window.__releaseMic()')
  alice.wait_for_function("window.__localStream?.getAudioTracks()[0].readyState==='ended'")
  assert alice.locator('#make-voice-call').is_enabled()
  stalled=browser.new_context(permissions=['microphone']).new_page();stalled.clock.install();stalled.goto(origin+'/?user=deadline')
  stalled.evaluate("()=>{const original=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=options=>new Promise(resolve=>{window.__releaseMic=async()=>resolve(await original(options))})}")
  stalled.locator('#make-voice-call').click();stalled.wait_for_function("window.__releaseMic && __peerObjects.some(p=>p.open)")
  stalled.clock.fast_forward(16000)
  stalled.wait_for_function("__notices.some(t=>t.includes('microphone did not start'))")
  assert stalled.locator('#make-voice-call').is_enabled()
  stalled.evaluate('window.__releaseMic()');stalled.wait_for_function("__localStream?.getAudioTracks()[0].readyState==='ended'")
  stalled.close()
  assert not errors,errors
  browser.close()
 print('PASS: real two-browser relayed WebRTC audio with verified received packets in Everyone and private rooms; one connection per pair; sound unlock; mute; immediate microphone cleanup; microphone denial, wrong-room rejection, delayed permission cancellation, cleanup while offline, named-channel isolation, live participants/mute indicators, browsing text during a call, synthesized/toggleable sound effects, HTTPS presence with stalled SDK streams, capture handoff, ended/interrupted microphone repair, basic-constraint fallback, signaling and media recovery, input levels, and a permission deadline with late-capture cleanup.')
finally:
 peer.terminate();peer.wait(timeout=5);turn.terminate();turn.wait(timeout=5);turn_log.close();server.shutdown();server.server_close()
