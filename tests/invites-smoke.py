from browser_executable import CHROMIUM
"""Share links, authenticated invite acceptance and post-login return; isolated backend."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [320,390,768,1440]:
  page=make_page(browser,ROOT,width,900)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/invite.html?code=STUDIO')
  page.wait_for_function("document.getElementById('accept-invite').textContent==='Open conversation'")
  assert page.locator('#invite-title').inner_text()=='The creative studio'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.screenshot(path=str(OUT/f'invite-{width}.png'),full_page=True)
  page.locator('#accept-invite').focus();page.keyboard.press('Enter')
  page.wait_for_url('**/home.html?channel=studio')
  page.wait_for_function("document.getElementById('channel-title').textContent==='The creative studio'")
  page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__copied=value}})")
  page.locator('#copy-join-code').click()
  page.wait_for_function("window.__copied==='http://localhost:8124/invite.html?code=STUDIO'")
  page.evaluate("()=>{navigator.clipboard.writeText=async()=>{throw new Error('Denied')}}")
  page.locator('#copy-join-code').click()
  page.wait_for_function("document.activeElement.id==='share-invite-link'")
  assert page.locator('#share-invite-link').input_value()=='http://localhost:8124/invite.html?code=STUDIO'
  page.keyboard.press('Escape')
  assert not errors,errors
  page.close()
 # New membership and the original join-code dialog both use the shared join operation.
 page=make_page(browser,ROOT)
 page.add_init_script("__testData.set('channels/new-room',{name:'New friends',createdBy:'maya',activeInvite:'NEW123',members:['maya']});__testData.set('channelInvites/NEW123',{channelId:'new-room',name:'New friends',createdBy:'maya',expiresAt:null,revoked:false})")
 page.goto('http://localhost:8124/invite.html?code=NEW123')
 page.wait_for_function("document.getElementById('accept-invite').textContent==='Accept invitation'")
 assert page.evaluate("__testData.get('channels/new-room').members.length")==1
 # Keep the successful navigation on this document so the actual CTA writes can be inspected.
 page.evaluate("""()=>{LyriaInvites.home=id=>{window.__accepted=id;return '#accepted'};const db=firebase.firestore(),batch=db.batch;window.__denyJoin=true;db.batch=()=>{const b=batch();const commit=b.commit;b.commit=()=>window.__denyJoin?Promise.reject(Object.assign(new Error('Denied'),{code:'permission-denied'})):commit();return b}}""")
 page.locator('#accept-invite').click()
 page.wait_for_function("document.getElementById('accept-invite').textContent==='Try again'")
 assert 'couldn’t confirm' in page.locator('#invite-status').inner_text()
 assert page.evaluate("__testData.get('channels/new-room').members.length")==1
 page.evaluate('window.__denyJoin=false');page.locator('#accept-invite').click()
 page.wait_for_url('**/invite.html?code=NEW123#accepted')
 result=page.evaluate("({id:__accepted,members:__testData.get('channels/new-room').members,channels:__testData.get('users/test-member').channels})")
 assert result['id']=='new-room' and 'test-member' in result['members'] and 'new-room' in result['channels']
 page.goto('http://localhost:8124/home.html')
 page.locator('#header-menu-toggle').click();page.locator('#join-channel').click()
 page.locator('#channel-action-input').fill('http://localhost:8124/invite.html?code=STUDIO')
 page.locator('#submit-channel-action').click()
 page.wait_for_function("document.getElementById('channel-title').textContent==='The creative studio'")
 page.close()
 for code,message in [('MISSING','no longer available'),('x','incomplete or invalid'),('','incomplete or invalid')]:
  page=make_page(browser,ROOT);page.goto('http://localhost:8124/invite.html?code='+code)
  page.wait_for_function("document.querySelector('.invite-card').getAttribute('aria-busy')==='false'")
  assert message in page.locator('#invite-status').inner_text()
  assert page.locator('#accept-invite').is_disabled();page.close()
 # Signed-out invitation survives either authentication choice without accepting silently.
 for button in ['google-signin','guest-login']:
  page=make_page(browser,ROOT)
  page.add_init_script("if(location.pathname.endsWith('invite.html')){const a=firebase.auth();a.currentUser=null;a.onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}}}")
  page.goto('http://localhost:8124/invite.html?code=STUDIO')
  page.wait_for_function("document.getElementById('accept-invite').textContent==='Continue to your invitation'")
  assert page.locator('#invite-title').inner_text()=='You’re invited.'
  page.locator('#accept-invite').click();page.wait_for_url('**/login.html?invite=STUDIO')
  page.locator('#'+button).click();page.wait_for_url('**/invite.html?code=STUDIO');page.close()
 page=make_page(browser,ROOT);page.goto('http://localhost:8124/invite.html?code=EVERYONE')
 page.wait_for_function("document.getElementById('invite-title').textContent==='Everyone'")
 assert page.evaluate("LyriaInvites.parse('https://evil.example/invite.html?code=STUDIO')") is None
 assert page.evaluate("LyriaInvites.parse('javascript:alert(1)')") is None
 page.close();browser.close()
print('PASS: shareable links, clipboard fallback, four invite layouts, explicit membership, correct selected room, link/code dialog, invalid invites, Everyone, and Google/guest return flow.')
