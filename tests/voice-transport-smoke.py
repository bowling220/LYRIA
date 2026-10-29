"""Credential fetch/caching/error deadlines; no real provider account or key."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page();page.clock.install();calls=[]
 def route(r):
  if 'fixture-app.metered.live' in r.request.url:
   calls.append(r.request.url);r.fulfill(json=[{'urls':'stun:fixture.test:3478'},{'urls':'turns:fixture.test:443?transport=tcp','username':'fixture','credential':'fixture-only'}])
  else:r.fulfill(body='<html></html>',content_type='text/html')
 page.route('**/*',route);page.goto('http://localhost:8126/')
 page.add_script_tag(content=(ROOT/'js/voice-config.js').read_text());page.add_script_tag(content=(ROOT/'js/voice-transport.js').read_text())
 assert not page.evaluate('(async()=> (await LyriaVoiceTransport.get()).relay)()')
 page.evaluate("LYRIA_VOICE_CONFIG.credentialsUrl='https://fixture-app.metered.live/api/v1/turn/credentials?apiKey=fixture-only'")
 assert page.evaluate('(async()=>{const a=await Promise.all([LyriaVoiceTransport.get(),LyriaVoiceTransport.get()]);return a.every(v=>v.relay)})()')
 assert len(calls)==1
 page.evaluate('LyriaVoiceTransport.get()');assert len(calls)==1
 page.clock.fast_forward(241000);page.evaluate('LyriaVoiceTransport.get()');assert len(calls)==2
 page.evaluate("()=>{LyriaVoiceTransport.clear();window.__fetch=fetch;window.fetch=(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));LyriaVoiceTransport.get().catch(e=>window.__relayFailure=e.message)}")
 page.clock.fast_forward(10001);page.wait_for_function('window.__relayFailure')
 assert 'too long' in page.evaluate('__relayFailure')
 page.evaluate('window.fetch=__fetch');assert page.evaluate('(async()=> (await LyriaVoiceTransport.get()).relay)()')
 page.evaluate("LyriaVoiceTransport.clear();window.fetch=async()=>new Response(JSON.stringify([{urls:'stun:fixture.test:3478'}]))")
 assert page.evaluate("async()=>{try{await LyriaVoiceTransport.get();return false}catch(e){return e.message.includes('relay configuration')}}")
 browser.close()
print('PASS: relay credential validation, caching and concurrent requests, expiration, timeout, retry, and rejection of a relay response containing only STUN.')
