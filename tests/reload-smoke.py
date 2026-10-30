"""Reload and connection recovery without production accounts or writes."""
from pathlib import Path
import hashlib,re
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
# Every first-party script and style carries its actual content hash.
for html in ROOT.glob('*.html'):
 for path,version in re.findall(r'(?:src|href)="([^"?#]+\.(?:js|css))\?v=([a-f0-9]+)"',html.read_text()):
  if path.startswith('http'):continue
  assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest().startswith(version),(html.name,path)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
 page=make_page(browser,ROOT);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("window.__stallChannels=!sessionStorage.getItem('reload-recovered');window.__stallMessages=window.__stallChannels;window.__stallRestQueries=window.__stallChannels;")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function('window.LyriaConnection && window.LyriaAccount.getProfile().displayName')
 page.locator('#message-input').fill('Keep this unsent message')
 page.wait_for_function("!document.getElementById('connection-notice').hidden",timeout=15000)
 assert page.locator('#connection-message').inner_text()
 page.evaluate("window.__stallChannels=false;window.__stallMessages=false;window.__stallRestQueries=false;window.__stallProfileRead=true;sessionStorage.setItem('reload-recovered','yes')")
 page.locator('#retry-connection').click()
 page.wait_for_function("document.getElementById('connection-notice').hidden")
 page.wait_for_function("document.querySelector('[data-channel-id=studio]')")
 assert 'Maya' in page.locator('#messages').inner_text()
 assert page.locator('#message-input').input_value()=='Keep this unsent message'
 assert page.evaluate('__networkRestarts')==1,'Recovery restarted live networking more than once'
 page.evaluate('window.__stallProfileRead=false')
 # Stream fails, reconnect, then browser back/forward restoration: one send only.
 page.evaluate("window.__failMessages=true;window.__failRestQueries=true;window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 page.wait_for_function("document.getElementById('connection-message').textContent.includes('disconnected')")
 page.evaluate('window.__failMessages=false;window.__failRestQueries=false')
 page.locator('#retry-connection').click();page.wait_for_function("document.getElementById('connection-notice').hidden")
 page.locator('#send-button').click()
 page.wait_for_function("[...__testData.values()].filter(v=>v.message==='Keep this unsent message').length===1")
 # Recovery after returning online does not need another full reload.
 page.context.set_offline(True);page.wait_for_function("document.getElementById('connection-message').textContent.includes('offline')")
 assert page.locator('#retry-connection').is_disabled()
 page.context.set_offline(False);page.wait_for_function("document.getElementById('connection-notice').hidden")
 # Repeated reloads still bind UI controls exactly once.
 for _ in range(3):
  page.reload();page.wait_for_function('window.LyriaAccount.getProfile().displayName')
  page.wait_for_function("document.getElementById('connection-notice').hidden && document.querySelector('[data-channel-id=studio]')")
  page.locator('#header-menu-toggle').click();page.locator('#settings-btn').click();assert page.locator('#settings-modal').is_visible();page.locator('#close-modal').click()
 # A missing required script offers a clear reload instead of a silent partial app.
 page.evaluate("()=>{const script=document.createElement('script');script.src='/missing-required-script.js';document.head.append(script);script.dispatchEvent(new Event('error'))}")
 page.wait_for_function("document.getElementById('retry-connection').textContent==='Reload LYRIA'")
 assert 'couldn’t load' in page.locator('#connection-message').inner_text()
 assert not errors,errors
 browser.close()
print('PASS: bounded startup feedback, stalled channels/messages recovery, stream failure, browser restoration, offline/online recovery, retained composer draft, repeated reload controls, script-load feedback, and content-versioned assets.')
