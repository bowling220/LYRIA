"""Adverse network, account and duplicate-submission checks using local fixtures only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
SDK_FIXTURE="""(()=>{const db=firebase.firestore(),Ref=db.collection('channels').constructor;
db.doc=path=>new Ref(path,true);
db.runTransaction=async callback=>{const writes=[];const result=await callback({get:ref=>ref.get(),set:(ref,value)=>writes.push(()=>ref.set(value)),update:(ref,value)=>writes.push(()=>ref.update(value)),delete:ref=>writes.push(()=>ref.delete())});for(const write of writes)await write();return result};})();"""
def home(page):
 page.goto('http://localhost:8124/home.html?channel=community')
 page.wait_for_function("document.querySelectorAll('.message').length===3 && document.getElementById('account-load-status').dataset.state==='ready' && !LyriaLoading.isBlocking()")
def count(page,message):
 return page.evaluate("text=>[...__testData].filter(([path,value])=>path.includes('/messages/') && value.message===text).length",message)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [390,1440]:
  page=make_page(browser,ROOT,width,900);page.add_init_script(SDK_FIXTURE+'window.__offlineAccount=true;');home(page)
  page.locator('#message-input').fill('SDK transport recovery');page.locator('#send-button').click()
  page.wait_for_function("document.getElementById('message-input').value===''")
  assert count(page,'SDK transport recovery')==1
  page.evaluate("__testData.set('users/sam',{displayName:'Sam',friends:[]});__testData.set('profiles/sam',{displayName:'Sam'});window.dispatchEvent(new CustomEvent('lyria:open-member-profile',{detail:{uid:'sam'}}))")
  page.wait_for_selector('#send-friend-request:visible');page.locator('#send-friend-request').click()
  page.wait_for_function("[...__testData.values()].filter(v=>v.from==='test-member' && v.to==='sam').length===1")
  page.close()
 print('PASS: mobile/desktop chat sends and friend-request queries/writes while REST is down and SDK works.',flush=True)
 # A successful server write followed by lost acknowledgement must not duplicate on retry.
 page=make_page(browser,ROOT);home(page)
 page.evaluate("""()=>{const f=fetch;let once=true;window.fetch=async(url,options)=>{const response=await f(url,options);if(once && String(url).endsWith(':commit') && JSON.parse(options.body).writes.some(w=>w.update?.name.includes('/messages/'))){once=false;return new Response(JSON.stringify({error:{message:'Lost acknowledgement'}}),{status:503})}return response}}""")
 page.locator('#message-input').fill('Lost ack');page.locator('#send-button').click();page.wait_for_function("!document.getElementById('send-button').disabled")
 assert count(page,'Lost ack')==1 and page.locator('#message-input').input_value()=='Lost ack'
 page.locator('#send-button').click();page.wait_for_function("document.getElementById('message-input').value===''")
 assert count(page,'Lost ack')==1
 # A later deliberate equal message is allowed; deduplication is by operation ID.
 page.locator('#message-input').fill('Lost ack');page.locator('#send-button').click();page.wait_for_function("document.getElementById('message-input').value===''")
 assert count(page,'Lost ack')==2;page.close()
 print('PASS: lost acknowledgement retry reconciles one operation; deliberate equal messages remain allowed.',flush=True)
 page=make_page(browser,ROOT);home(page)
 page.evaluate("""()=>{const commit=LyriaDataAPI.commit;window.__attempts=0;LyriaDataAPI.commit=async writes=>{if(writes.some(w=>w.update?.name.includes('/messages/'))){__attempts++;await new Promise(r=>window.__release=r)}return commit(writes)}}""")
 page.locator('#message-input').fill('Double tap')
 page.evaluate("()=>{const b=document.getElementById('send-button');b.click();b.click();document.getElementById('message-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))}")
 assert page.evaluate('__attempts')==1;page.evaluate('__release()');page.wait_for_function("document.getElementById('message-input').value===''");assert count(page,'Double tap')==1;page.close()
 print('PASS: rapid double tap plus Enter produces one message.',flush=True)
 for mode in ['expired','revoked']:
  page=make_page(browser,ROOT)
  page.add_init_script("const record=__testData.get('channelInvites/STUDIO');record.revoked="+('true' if mode=='revoked' else 'false')+";record.expiresAt="+("null" if mode=='revoked' else "new Date(Date.now()-60000)")+";if(!sessionStorage.getItem('edge-auth')){const a=firebase.auth();a.currentUser=null;a.onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}};a.signInWithPopup=async()=>{sessionStorage.setItem('edge-auth','yes');return {user:{uid:'test-member'}}}}")
  page.goto('http://localhost:8124/invite.html?code=STUDIO');page.wait_for_function("document.getElementById('accept-invite').textContent==='Continue to your invitation'")
  assert page.locator('#invite-title').inner_text()=='You’re invited.'
  page.locator('#accept-invite').click();page.wait_for_url('**/login.html?invite=STUDIO');page.locator('#google-signin').click();page.wait_for_url('**/invite.html?code=STUDIO')
  page.wait_for_function("document.getElementById('accept-invite').textContent==='Invitation unavailable'");assert page.locator('#accept-invite').is_disabled();page.close()
 print('PASS: expired/revoked links stay unavailable after signed-out login return.',flush=True)
 # Sign-out and new login retain neither another user's draft nor their open panel.
 page=make_page(browser,ROOT,1440,1000)
 page.add_init_script("""const a=firebase.auth();if(sessionStorage.getItem('edge-account')==='second'){Object.assign(a.currentUser,{uid:'second-member',displayName:'Second Account',email:'second@example.test'});__testData.set('users/second-member',{displayName:'Second Account',bio:'Second bio',friends:[],channels:[],badges:[]});__testData.set('profiles/second-member',{displayName:'Second Account',bio:'Second bio',badges:[]})};a.signOut=async()=>{a.currentUser=null;sessionStorage.setItem('edge-account','second')};if(location.pathname.endsWith('login.html')){const next=a.currentUser;a.currentUser=null;a.onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}};a.signInWithPopup=async()=>{a.currentUser=next;return {user:next}}}""")
 home(page);page.locator('#rail-settings').click();page.locator('#bio-input').fill('FIRST ACCOUNT PRIVATE DRAFT')
 page.wait_for_function("sessionStorage.getItem('lyria-profile-draft:test-member')?.includes('FIRST ACCOUNT PRIVATE DRAFT')")
 page.locator('#logout-btn').click();page.wait_for_url('**/login.html*');page.locator('#google-signin').click();page.wait_for_url('**/home.html*')
 page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
 assert page.locator('#settings-modal').is_hidden();page.locator('#rail-settings').click()
 assert page.locator('#bio-input').input_value()!='FIRST ACCOUNT PRIVATE DRAFT';assert page.evaluate('firebase.auth().currentUser.uid')=='second-member';page.close()
 print('PASS: sign-out/login account draft and panel isolation.',flush=True)
 browser.close()
