"""Opt-in public contributor space and reliable private creation; no production writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [390,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.__copied=value},configurable:true})")
  page.goto('http://localhost:8124/home.html?view=hub');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready' && !LyriaLoading.isBlocking()")
  assert page.locator('[data-channel-id="developers"]').count()==0
  page.locator('#join-developers').click();page.wait_for_function("document.getElementById('channel-title').textContent==='Developers'")
  assert 'public' in page.locator('#community-notice').inner_text()
  page.locator('#message-input').fill('Happy to help build LYRIA');page.locator('#send-button').click();page.wait_for_function("[...__testData].some(([path,value])=>path.startsWith('channels/developers/messages/') && value.message==='Happy to help build LYRIA')")
  assert not page.evaluate("__testData.has('channels/developers')"),'Public access needs no growing membership document'
  page.locator('#copy-join-code').click();page.wait_for_function("window.__copied?.endsWith('invite.html?code=DEVELOPERS')")
  page.reload();page.wait_for_function("document.getElementById('channel-title').textContent==='Developers' && !LyriaLoading.isBlocking()")
  if width<769:page.locator('#header-menu-toggle').click()
  page.locator('#leave-channel').click();page.wait_for_selector('#channel-action-modal[data-mode=leave]');assert 'device' in page.locator('#channel-action-description').inner_text();page.locator('#submit-channel-action').click()
  page.wait_for_function("document.querySelector('.chat-area').dataset.view==='hub' && !document.querySelector('[data-channel-id=developers]')")
  page.reload();page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready' && !LyriaLoading.isBlocking()")
  assert page.locator('[data-channel-id="developers"]').count()==0
  # A normal private conversation remains private and failures are safely retryable.
  page.locator('#panel-create' if width<769 else '#hub-create').click();page.locator('#channel-action-input').fill('A private planning room');page.evaluate('__failCommit=true');page.locator('#submit-channel-action').click();page.wait_for_function("!document.getElementById('submit-channel-action').disabled")
  assert 'sign out' not in page.locator('#channel-action-feedback').inner_text().lower()
  pending=page.evaluate("JSON.parse(sessionStorage.getItem('lyria:channel-create:test-member')).id")
  page.evaluate('__failCommit=false');page.locator('#submit-channel-action').click();page.wait_for_function("document.getElementById('channel-title').textContent==='A private planning room'")
  assert page.evaluate("id=>__testData.get('channels/'+id).isPublic===false && __testData.get('channels/'+id).createdBy==='test-member'",pending)
  assert not page.evaluate("__testData.get('users/test-member').badges.some(b=>['admin','developer','moderator','DevBadge'].includes(b))")
  assert not errors,errors;page.close()
 for method in ['google-signin','guest-login']:
  page=make_page(browser,ROOT)
  page.add_init_script("""if(!sessionStorage.getItem('developers-login')){const a=firebase.auth(),user=a.currentUser;a.currentUser=null;a.onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}};a.signInWithPopup=a.signInAnonymously=async()=>{sessionStorage.setItem('developers-login','yes');a.currentUser=user;return {user}}}""")
  page.goto('http://localhost:8124/invite.html?code=DEVELOPERS');page.wait_for_function("document.getElementById('accept-invite').textContent==='Continue to Developers'");page.locator('#accept-invite').click();page.wait_for_url('**/login.html?invite=DEVELOPERS');page.locator('#'+method).click();page.wait_for_url('**/invite.html?code=DEVELOPERS');page.wait_for_function("document.getElementById('accept-invite').textContent==='Join Developers'");page.locator('#accept-invite').click();page.wait_for_url('**/home.html?channel=developers');page.wait_for_function("document.getElementById('channel-title').textContent==='Developers'");page.close()
 page=make_page(browser,ROOT)
 page.add_init_script("const a=firebase.auth();a.currentUser=null;a.onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}};")
 page.goto('http://localhost:8124/home.html?channel=developers');page.wait_for_url('**/login.html?invite=DEVELOPERS');page.close()
 browser.close()
print('PASS: opt-in Developers, real messages, public share link, reload/hide preferences, private creation retry, no role grants, and Google/guest public entry.')
