"""Real Firebase CDN SDK + local Auth emulator. Never signs into the live project."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML='''<!doctype html><title>Local auth security check</title>
<script src="https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/13.1.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore-compat.js"></script>
<script>firebase.initializeApp({apiKey:'demo-key',projectId:'demo-lyria',authDomain:'demo-lyria.firebaseapp.com',appId:'demo-app'});firebase.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});</script>
<script src="/config.js"></script><script>firebaseConfig.initialize().then(()=>firebaseConfig.getAuth().onAuthStateChanged(user=>{window.authRestored=true;window.restoredUid=user?.uid || null}));</script>'''
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  version='11.10.0' if 'sdk=11.10.0' in self.path else '13.1.0'
  body=(ROOT/'js/config.js').read_bytes() if self.path=='/config.js' else HTML.replace('/13.1.0/','/'+version+'/').encode()
  self.send_response(200);self.send_header('Content-Type','text/javascript' if self.path=='/config.js' else 'text/html');self.end_headers();self.wfile.write(body)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox']);page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  base='http://127.0.0.1:'+str(server.server_port)
  page.goto(base+'?sdk=11.10.0');page.wait_for_function('window.authRestored===true',timeout=30000)
  assert page.evaluate('firebaseConfig.getApp().options.projectId')=='demo-lyria'
  uid=page.evaluate("async()=>{const result=await firebaseConfig.getAuth().signInAnonymously();return result.user.uid}")
  page.goto(base+'?sdk=13.1.0');page.wait_for_function('window.authRestored===true');assert page.evaluate('window.restoredUid')==uid
  page.reload();page.wait_for_function('window.authRestored===true');assert page.evaluate('window.restoredUid')==uid
  page.evaluate('firebaseConfig.getAuth().signOut()');page.reload();page.wait_for_function('window.authRestored===true');assert page.evaluate('window.restoredUid') is None
  assert not errors,errors
  browser.close()
 print('PASS: real Firebase 11→13 Auth emulator upgrade, configured local persistence, session restoration and sign-out; no production account access.')
finally:server.shutdown()
