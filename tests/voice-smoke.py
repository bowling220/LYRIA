"""Real two-browser WebRTC checks using a local PeerJS server and a room-presence fixture.
No production Firebase, microphone, signaling service, or TURN credentials are used.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from threading import Thread,Lock
import json, subprocess, socket, time, urllib.request, os, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STATE={};LOCK=Lock()
PEER=urllib.request.urlopen('https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js',timeout=20).read()
with socket.socket() as sock:sock.bind(('127.0.0.1',0));SIGNAL_PORT=sock.getsockname()[1]
with socket.socket() as sock:sock.bind(('127.0.0.1',0));TURN_PORT=sock.getsockname()[1]
TURN_BINARY=os.environ.get('LYRIA_TEST_TURN_BINARY') or shutil.which('turnserver')
if not TURN_BINARY:raise RuntimeError('Install coturn or set LYRIA_TEST_TURN_BINARY to its turnserver executable.')
HTML='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body>
<button id="make-voice-call">Join voice</button><button id="end-call">Leave voice</button>
<section id="voice-panel" hidden><p id="voice-status"></p><button id="voice-mute">Mute</button><button id="voice-enable-sound" hidden>Enable sound</button><button id="voice-retry" hidden>Rejoin voice</button></section>
<script src="/fixture.js"></script><script src="/peer.js"></script><script src="/voiceCall.js"></script><script>LyriaVoice.setRoom('community');</script>'''
FIXTURE=r'''
const uid=new URL(location.href).searchParams.get('user');window.__notices=[];window.__rtc=[];
const NativeRTC=window.RTCPeerConnection;window.RTCPeerConnection=class extends NativeRTC{constructor(...args){super(...args);window.__rtc.push(this)}};
window.LyriaUI={icon:()=>'',notify:(message)=>__notices.push(message)};
window.LYRIA_VOICE_CONFIG={signaling:{host:'127.0.0.1',port:SIGNAL_PORT,path:'/voice',secure:false},iceServers:[{urls:'turn:127.0.0.1:TURN_PORT?transport=tcp',username:'fixture',credential:'local-only'}]};
const mic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async options=>{if(window.__denyMic)throw new DOMException('Denied','NotAllowedError');const stream=await mic(options);window.__localStream=stream;return stream};
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
 onSnapshot(fn,error){let active=true,busy=false;const read=async()=>{if(busy)return;busy=true;try{const snapshot=await this.get();if(active)fn(snapshot)}catch(e){if(active)error?.(e)}finally{busy=false}};read();const timer=setInterval(read,80);return()=>{active=false;clearInterval(timer)}}
}
const db={collection:()=>({doc:room=>new Ref(room)}),runTransaction:async work=>{
 let expected;const operations=[];await work({get:async ref=>{const result=await ref.get();expected=result.data().voice?.sessionId;return result},update:(ref,patch)=>operations.push(request(ref.room,{uid:ref.id,patch,expected}))});await Promise.all(operations)
}};
const fs=()=>db;fs.FieldValue={serverTimestamp:()=>({serverTime:true}),delete:()=>({deleteField:true})};
window.firebase={firestore:fs};window.firebaseConfig={getAuth:()=>({currentUser:{uid}}),getFirestore:()=>db};
'''.replace('SIGNAL_PORT',str(SIGNAL_PORT)).replace('TURN_PORT',str(TURN_PORT))
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  from urllib.parse import urlparse,parse_qs
  url=urlparse(self.path)
  if url.path=='/presence':
   room=parse_qs(url.query)['room'][0]
   with LOCK:body=json.dumps(STATE.get(room,{})).encode()
   content='application/json'
  elif url.path=='/peer.js':body=PEER;content='text/javascript'
  elif url.path=='/fixture.js':body=FIXTURE.encode();content='text/javascript'
  elif url.path=='/voiceCall.js':body=(ROOT/'voiceCall.js').read_bytes();content='text/javascript'
  else:body=HTML.encode();content='text/html'
  self.send_response(200);self.send_header('Content-Type',content);self.end_headers();self.wfile.write(body)
 def do_POST(self):
  from urllib.parse import urlparse,parse_qs
  room=parse_qs(urlparse(self.path).query)['room'][0];data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  with LOCK:
   target=STATE.setdefault(room,{}).setdefault(data['uid'],{})
   if 'expected' not in data or target.get('voice',{}).get('sessionId')==data['expected']:
    for key,value in data['patch'].items():
     if key=='voice' and value.get('deleteField'):target.pop('voice',None)
     elif key=='voice':target['voice']={**value,'updatedAt':time.time()*1000}
     elif key=='voice.updatedAt' and target.get('voice'):target['voice']['updatedAt']=time.time()*1000
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
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  a=browser.new_context(permissions=['microphone']);b=browser.new_context(permissions=['microphone'])
  alice=a.new_page();bob=b.new_page();errors=[]
  for page in [alice,bob]:page.on('pageerror',lambda error:errors.append(str(error)))
  alice.goto(origin+'/?user=alice');bob.goto(origin+'/?user=bob');bob.evaluate('window.__blockSound=true')
  for page in [alice,bob]:page.evaluate("""port=>{delete LYRIA_VOICE_CONFIG.iceServers;peerjs.util.defaultConfig={iceServers:[{urls:'turn:127.0.0.1:'+port,username:'fixture',credential:'local-only'}]};}""",TURN_PORT)

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
  with LOCK:alice_peer=STATE['community']['alice']['voice']['peerId']
  bob.evaluate("""target=>new Promise(resolve=>{
    const rogue=new Peer('rogue-'+crypto.randomUUID(),{host:'127.0.0.1',port:SIGNAL_PORT,path:'/voice',secure:false,config:{iceServers:[]}});
    rogue.on('open',()=>{rogue.call(target,__localStream,{metadata:{roomId:'wrong-room',sessionId:'unknown'}});window.__roguePeer=rogue;resolve()});
  })""".replace('SIGNAL_PORT',str(SIGNAL_PORT)),alice_peer)
  alice.wait_for_timeout(300)
  assert alice.locator('audio').count()==1,'A call from another room was accepted'
  bob.evaluate('window.__roguePeer.destroy()')
  for page in [alice,bob]:assert page.evaluate("async()=>{for(const pc of __rtc){const stats=await pc.getStats();for(const pair of stats.values()){if(pair.type==='candidate-pair'&&pair.state==='succeeded'&&stats.get(pair.localCandidateId)?.candidateType==='relay')return true}}return false}"),'No relayed audio connection was verified'
  alice.locator('#voice-mute').click();assert not alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  alice.locator('#voice-mute').click();assert alice.evaluate('__localStream.getAudioTracks()[0].enabled')
  alice.evaluate("LyriaVoice.setRoom('private-studio')")
  assert alice.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended'
  assert alice.locator('audio').count()==0
  bob.wait_for_function("document.querySelectorAll('.voice-remote-audio').length===0")
  bob.locator('#end-call').click();assert bob.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended'
  bob.evaluate("LyriaVoice.setRoom('private-studio')")
  alice.locator('#make-voice-call').click();bob.locator('#make-voice-call').click()
  for page in [alice,bob]:page.wait_for_function("document.querySelectorAll('.voice-remote-audio').length===1",timeout=25000)
  for page in [alice,bob]:page.wait_for_function("async()=>{for(const pc of __rtc.filter(pc=>pc.connectionState==='connected')){const stats=await pc.getStats();if([...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0))return true}return false}",timeout=10000)
  alice.evaluate('window.__blockCleanup=true');alice.locator('#end-call').click();assert alice.evaluate('__localStream.getAudioTracks()[0].readyState')=='ended';bob.locator('#end-call').click()
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
  assert not errors,errors
  browser.close()
 print('PASS: real two-browser relayed WebRTC audio with verified received packets in Everyone and private rooms; one connection per pair; sound unlock; mute; immediate microphone cleanup; microphone denial, wrong-room rejection, delayed permission cancellation, and cleanup while offline.')
finally:
 peer.terminate();peer.wait(timeout=5);turn.terminate();turn.wait(timeout=5);turn_log.close();server.shutdown();server.server_close()
