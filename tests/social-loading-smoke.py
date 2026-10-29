"""Chats and friend requests remain usable when Firestore streams never open."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height in [(390,844),(1440,1000)]:
  page=make_page(browser,ROOT,width,height);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('window.__stallMessages=true;window.__stallRequests=true;window.__stallChannels=true;window.__stallProfileRead=true;')
  for _ in range(2):
   page.goto('http://localhost:8124/home.html?channel=community')
   page.wait_for_function("document.querySelectorAll('.message').length===3 && document.querySelector('[data-channel-id=studio]')")
   page.wait_for_function("document.getElementById('friend-request-count').textContent==='1'")
   assert page.locator('#connection-notice').is_hidden()
   page.reload();page.wait_for_function("document.querySelectorAll('.message').length===3")
  page.locator('#message-input').fill('Sent while live streams are stalled');page.locator('#send-button').click()
  page.wait_for_function("document.getElementById('messages').textContent.includes('Sent while live streams are stalled')")
  page.goto('http://localhost:8124/inbox.html')
  page.wait_for_function("document.querySelectorAll('.accept-btn').length===1")
  assert 'Maya Chen' in page.locator('#inbox-messages').inner_text()
  # A sender profile that never answers must not hide the request or its buttons.
  page.add_init_script("window.__stallProfileUid='maya'")
  page.reload();page.wait_for_function("document.querySelectorAll('.accept-btn').length===1")
  assert page.locator('.accept-btn').is_enabled()
  page.locator('.accept-btn').click()
  page.wait_for_function("document.getElementById('inbox-messages').textContent.includes('caught up')")
  assert page.evaluate("__testData.get('users/maya').friends.includes('test-member')")
  assert page.evaluate("[...__testData.values()].some(v=>v.to==='accepted_maya' && v.status==='accepted')")
  # A failed response keeps the request and makes controls available again.
  page.evaluate("__testData.set('friendRequests/second',{from:'maya',fromName:'Maya Chen',to:'test-member',status:'pending'});window.__failCommit=true;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
  page.wait_for_function("document.querySelectorAll('.decline-btn').length===1")
  page.locator('.decline-btn').click()
  page.wait_for_function("document.getElementById('connection-message').textContent.includes('confirm')")
  assert page.locator('.decline-btn').is_enabled()
  assert page.evaluate("__testData.has('friendRequests/second')")
  page.evaluate('window.__failCommit=false');page.locator('#retry-connection').click()
  page.wait_for_function("document.getElementById('connection-notice').hidden")
  page.locator('.decline-btn').click();page.wait_for_function("!__testData.has('friendRequests/second')")
  page.screenshot(path=str(ROOT/f'test-artifacts/social-loading-{width}.png'))
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: chat history and request badges after repeated reloads with stalled streams; inbox without sender profiles; accept/decline; failed-response recovery; mobile and desktop.')
