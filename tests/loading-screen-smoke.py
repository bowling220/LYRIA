"""Loading is real, works for returning users and never traps a working chat."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width,height in [(390,844),(667,375),(1440,1000)]:
  page=make_page(browser,ROOT,width,height);errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script("""const a=firebase.auth();window.__authWaiters=[];a.onAuthStateChanged=fn=>{__authWaiters.push(fn);return()=>{}};window.__releaseAuth=()=>__authWaiters.forEach(fn=>fn(a.currentUser));""")
  page.goto('http://localhost:8124/home.html?channel=community')
  page.wait_for_selector('#app-loading-modal[data-ui-open=true]')
  assert page.locator('#app-loading-modal h2').inner_text()=='Opening LYRIA.'
  assert page.locator('#app-loading-modal .app-loading-track').is_visible()
  box=page.locator('#app-loading-modal .modal-content').bounding_box()
  assert box['y']>=0 and box['y']+box['height']<=height+1,(width,box)
  assert abs(box['y']+box['height']/2-height/2)<4,(width,'startup should be centered',box)
  page.emulate_media(reduced_motion='reduce')
  assert page.locator('#app-loading-modal .app-loading-track span').evaluate("el=>getComputedStyle(el).animationName==='none'")
  page.emulate_media(reduced_motion='no-preference')
  page.screenshot(path=str(OUT/f'loading-startup-{width}.png'))
  page.evaluate('__releaseAuth()');page.wait_for_selector('.message')
  page.wait_for_function("document.getElementById('app-loading-modal').style.display==='none'")
  page.locator('#message-input').fill('My draft stays here')
  page.evaluate("LyriaConnection.pending('startup')")
  page.wait_for_selector('#app-loading-modal[data-ui-open=true]')
  page.get_by_role('button',name='Keep browsing',exact=True).click()
  page.evaluate("LyriaConnection.fail('startup','Connection is still unavailable.')")
  page.wait_for_timeout(100)
  assert page.locator('#app-loading-modal').is_hidden()
  assert page.locator('#message-input').input_value()=='My draft stays here'
  page.evaluate("LyriaConnection.ready('startup')")
  assert not errors,errors
  page.close()
 # The initial message view is a loading screen, but navigation and drafts work.
 page=make_page(browser,ROOT,390,844)
 page.add_init_script('window.__stallMessages=true;window.__stallRestQueries=true')
 page.goto('http://localhost:8124/home.html?channel=community')
 page.wait_for_selector('#messages [data-loading-part=messages]')
 assert page.locator('#app-loading-modal').is_hidden()
 page.locator('#message-input').fill('Keep this while waiting')
 page.screenshot(path=str(OUT/'loading-conversation-mobile.png'))
 page.evaluate("LyriaConnection.fail('messages','Your conversation couldn’t load. Try again.')")
 assert page.locator('#messages .app-loading-retry').is_visible()
 page.evaluate('window.__stallMessages=false;window.__stallRestQueries=false')
 page.locator('#messages .app-loading-retry').click();page.wait_for_selector('.message')
 assert page.locator('#messages [data-loading-part]').count()==0
 assert page.locator('#message-input').input_value()=='Keep this while waiting'
 assert page.evaluate('__networkRestarts')==1
 # Healthy loaded messages remain visible during a background reconnect.
 page.evaluate("LyriaConnection.pending('messages')")
 page.wait_for_timeout(750)
 assert page.locator('.message').count()>0
 assert page.locator('#messages [data-loading-part]').count()==0
 page.evaluate("LyriaConnection.ready('messages')");page.close()
 # Inbox requests use the same feedback without a version/update dependency.
 page=make_page(browser,ROOT,390,844)
 page.add_init_script('window.__stallRequests=true;window.__stallRestQueries=true')
 page.goto('http://localhost:8124/inbox.html')
 page.wait_for_selector('#inbox-messages [data-loading-part=requests]')
 page.evaluate('window.__stallRequests=false;window.__stallRestQueries=false')
 page.locator('#retry-connection').evaluate('el=>el.click()')
 page.wait_for_selector('.inbox-message')
 assert page.locator('#inbox-messages [data-loading-part]').count()==0
 page.close();browser.close()
print('PASS: returning-user startup screen at three sizes; automatic readiness, skip, retained drafts, inline slow messages/inbox, shared retry, and unobstructed loaded conversations.')
