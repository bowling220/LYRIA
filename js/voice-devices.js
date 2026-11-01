/* Explicit local diagnostics. Never capture or connect automatically on reload. */
(() => {
 const $=id=>document.getElementById(id),input=$('voice-input-device'),status=$('voice-device-status');
 let version=0,stream,context,source,analyser,timer,meterTimer,testing=false,lastRelay='Not tested';
 const relayConfigured=()=>!!window.LYRIA_VOICE_CONFIG?.credentialsUrl || (window.LYRIA_VOICE_CONFIG?.iceServers || []).some(s=>(Array.isArray(s.urls)?s.urls:[s.urls]).some(url=>/^turns?:/.test(url)));
 $('voice-relay-status').textContent=relayConfigured()?'A voice relay is configured. Run the connection test to verify it.':'Direct connections only. Reliable calls across different networks need a TURN relay.';
 $('voice-copy-diagnostics').addEventListener('click',()=>{const node=$('voice-safe-diagnostics');node.hidden=false;node.textContent=['LYRIA voice diagnostics','Network: '+(navigator.onLine?'Online':'Offline'),'Secure context: '+(isSecureContext?'Yes':'No'),'WebRTC: '+(typeof RTCPeerConnection==='function'?'Available':'Unavailable'),'Microphone API: '+(navigator.mediaDevices?.getUserMedia?'Available':'Unavailable'),'Relay configured: '+(relayConfigured()?'Yes':'No'),'Last relay test: '+lastRelay,'No keys, credentials, account IDs, device IDs, or IP addresses included.'].join('\n')});
 function stop(){++version;clearTimeout(timer);clearInterval(meterTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;source?.disconnect();context?.close().catch(()=>{});context=null;testing=false;input.disabled=false;$('voice-test-input').disabled=false;$('voice-stop-test').hidden=true;$('voice-device-level').value=0}
 async function devices(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{const selected=window.LyriaVoice.getInputDevice(),list=await navigator.mediaDevices.enumerateDevices();input.replaceChildren(new Option('System default microphone',''));let n=0;
    for(const device of list.filter(d=>d.kind==='audioinput'))input.append(new Option(device.label || 'Microphone '+(++n),device.deviceId));
    if([...input.options].some(o=>o.value===selected))input.value=selected;else if(selected){input.append(new Option('Previously selected microphone (unavailable)',selected));input.value=selected}
  }catch{status.textContent='Device names are unavailable. You can still try the system default.'}
 }
 input.addEventListener('change',async()=>{input.disabled=true;status.textContent='Selecting microphone…';try{await window.LyriaVoice.setInputDevice(input.value);status.textContent='Microphone preference updated. It applies to your next capture and active call.'}catch{input.value=window.LyriaVoice.getInputDevice();status.textContent='Could not change microphone. Your previous input is still selected.'}finally{input.disabled=false}});
 $('voice-test-input').addEventListener('click',async()=>{
  if(testing)return;stop();const run=version;testing=true;input.disabled=true;$('voice-test-input').disabled=true;$('voice-stop-test').hidden=false;status.textContent='Allow microphone access to check your input…';
  try{const capture=await window.LyriaVoice.prepare();if(run!==version){capture.getTracks().forEach(t=>t.stop());return}stream=capture;
    const Audio=window.AudioContext || window.webkitAudioContext;context=new Audio();await context.resume();if(run!==version)return;
    source=context.createMediaStreamSource(stream);analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);let detected=false;
    status.textContent='Microphone opened. Speak to test the level; this test stops after five seconds.';
    meterTimer=setInterval(()=>{if(!analyser)return;const bytes=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(bytes);const level=Math.min(1,Math.sqrt(bytes.reduce((sum,v)=>sum+((v-128)/128)**2,0)/bytes.length)*4);$('voice-device-level').value=level;if(level>.02)detected=true},100);
    devices();timer=setTimeout(()=>{stop();status.textContent=detected?'Microphone ready — input detected.':'Microphone opened, but no input was detected. Check your device or try another microphone.'},5000);
  }catch(error){if(run!==version)return;stop();status.textContent=error.name==='NotAllowedError'?'Microphone permission was denied. Allow it in your browser’s site settings and try again.':error.message || 'The microphone could not open.'}
 });
 $('voice-stop-test').addEventListener('click',()=>{stop();status.textContent='Microphone test stopped.'});
 $('voice-test-connection').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;status.textContent='Checking the voice relay…';try{const result=await window.LyriaVoiceTransport.probe();lastRelay=result.ready?'Verified':'No relay';status.textContent=result.ready?'Voice relay verified. Your microphone was not opened.':'No voice relay is configured. Calls across different networks may fail; the owner needs to finish TURN setup.'}catch(error){lastRelay='Failed';window.LyriaVoiceTransport.clear();status.textContent=error.message || 'Could not verify the voice relay. Please retry.'}finally{button.disabled=false}});
 new MutationObserver(()=>{if($('settings-modal').style.display==='none' && testing){stop();status.textContent='Microphone test stopped.'}}).observe($('settings-modal'),{attributes:true,attributeFilter:['style']});
 navigator.mediaDevices?.addEventListener?.('devicechange',devices);window.addEventListener('pagehide',stop);devices();
})();
