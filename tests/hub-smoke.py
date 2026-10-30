"""Conversation home, browser history and Firebase session restoration."""
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [320,390,768,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/home.html')
  page.wait_for_selector('.hub-conversation',state='visible')
  assert page.locator('.message-input').is_hidden()
  assert page.locator('.message').count()==0
  assert page.locator('#make-voice-call').is_disabled()
  assert page.locator('#voice-channels button:enabled').count()==0
  assert page.evaluate('window.__authPersistence')=='local'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.locator('#hub-search').fill('Studio')
  assert page.locator('.hub-conversation').count()==1
  page.locator('.hub-conversation').click();page.wait_for_selector('.message-input',state='visible')
  assert 'channel=studio' in page.url
  page.locator('#back-to-hub').click();assert 'view=hub' in page.url
  page.reload();page.wait_for_selector('#conversation-hub',state='visible')
  assert page.locator('.message-input').is_hidden()
  page.locator('#hub-search').fill('nonsense');assert 'No conversations' in page.locator('#hub-conversations').inner_text()
  page.locator('#hub-search').fill('Everyone');page.locator('.hub-conversation').click()
  page.go_back();page.wait_for_selector('#conversation-hub',state='visible')
  page.go_forward();page.wait_for_selector('.message-input',state='visible')
  page.goto('http://localhost:8124/login.html');page.wait_for_url('**/home.html?view=hub')
  assert not errors,errors
  page.screenshot(path='/tmp/lyria-hub-'+str(width)+'.png');page.close()
 browser.close()
print('PASS: hub, search, no forced chat, history, reload, saved-session login redirect and four screen sizes.')
