"""Real UI handlers with isolated Firebase fixtures; no production reads or writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
root=Path(__file__).resolve().parents[1]
out=root/'test-artifacts'/'community-shell';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for w,h in [(1920,1080),(1440,1000),(1280,960),(1024,768),(820,1180),(768,1024),(430,932),(390,844),(375,812),(320,568),(667,375)]:
  print('Checking community layout',w,h,flush=True)
  page=make_page(b,root,w,h,w<=768);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' and ('Unhandled promise' in m.text or 'Global error:' in m.text) else None)
  page.goto('http://localhost:8124/home.html?view=hub');page.wait_for_selector('#channels-list .channel-btn[data-channel-id=studio]')
  page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  assert page.locator('.app-rail').is_visible()
  if w<=768:assert page.locator('.conversation-panel').is_visible() and page.locator('.chat-panel').is_hidden()
  page.locator('#conversation-search').fill('creative');assert page.locator('#channels-list li:visible').count()==1
  page.locator('#conversation-search').fill('');page.locator('#channels-list [data-channel-id=studio]').click()
  page.wait_for_function("document.getElementById('details-title').textContent==='The creative studio'")
  assert 'channel=studio' in page.url
  if w<=768:assert page.locator('.chat-panel').is_visible() and page.locator('.conversation-panel').get_attribute('aria-hidden')=='true'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(w,'page overflow')
  assert page.locator('#message-input').is_visible()
  page.locator('#message-input').fill('A real redesigned conversation');page.locator('#send-button').click();page.wait_for_function("document.getElementById('messages').textContent.includes('A real redesigned conversation')")
  if w>=1200:assert page.locator('.lyria-shell>.details-panel').is_visible()
  page.locator('#conversation-details-toggle').click();page.wait_for_selector('#conversation-details-dialog[data-ui-open=true]')
  page.wait_for_function("document.getElementById('details-members').children.length===2")
  assert page.locator('#details-settings').is_hidden(),'Non-owner must not get management control'
  page.locator('#details-pin').click();assert page.locator('#details-pin').get_attribute('aria-pressed')=='true'
  page.locator('#close-conversation-details').click();page.wait_for_selector('#conversation-details-dialog[data-ui-open=false]',state='attached')
  assert page.locator('#conversation-details-toggle').evaluate('el=>el===document.activeElement')
  page.locator('#composer-tools').evaluate('el=>el.click()');page.wait_for_selector('#composer-tools-modal[data-ui-open=true]')
  page.get_by_role('button',name='Insert 🌿',exact=True).click();assert '🌿' in page.locator('#message-input').input_value()
  page.locator('#message-input').fill('')
  page.locator('#gif-button').click();page.locator('[data-gif-id=wave]').click();page.wait_for_function("!document.getElementById('gif-picker-action').disabled")
  page.locator('#gif-picker-action').click();page.wait_for_selector('.chat-gif img')
  page.locator('#conversation-details-toggle').click();page.wait_for_function("document.getElementById('details-media').children.length===1")
  page.locator('#close-conversation-details').click()
  page.locator('#rail-chats').click();page.wait_for_function("document.querySelector('.chat-area').dataset.view==='hub'")
  page.locator('[data-filter=pinned]').click();assert page.locator('#channels-list li:visible').count()==1
  page.locator('[data-filter=all]').click()
  page.locator('#channels-list [data-channel-id=personal-test-member]').click();page.wait_for_selector('.message')
  page.locator('#conversation-details-toggle').click();page.wait_for_function("!document.getElementById('details-settings').hidden")
  if w==1440:
   page.locator('#details-settings').click();page.wait_for_selector('#conversation-settings-modal[data-ui-open=true]')
   assert page.locator('#settings-leave-conversation').is_disabled()
   page.keyboard.press('Escape')
   page.locator('#details-members button').first.click();page.wait_for_selector('#profile-modal[data-ui-open=true]')
   assert page.locator('#profile-modal-name').inner_text()=='Alex Morgan'
   page.keyboard.press('Escape')
  page.locator('#close-conversation-details').click()
  if w==1440:
   page.locator('#conversation-favorite').click();page.wait_for_function("document.getElementById('conversation-favorite').getAttribute('aria-pressed')==='true'")
   page.locator('#rail-chats').click();page.locator('[data-filter=favorites]').click();assert page.locator('#channels-list li:visible').count()==1
   page.locator('[data-filter=all]').click();page.locator('#channels-list [data-channel-id=personal-test-member]').click()
   page.locator('#conversation-details-toggle').click();page.wait_for_selector('#conversation-details-dialog[data-ui-open=true]');page.wait_for_timeout(150)
   page.reload();page.wait_for_selector('#conversation-details-dialog[data-ui-open=true]');page.locator('#close-conversation-details').click()
  page.locator('#rail-settings').click();page.wait_for_selector('#settings-modal[data-ui-open=true]');page.keyboard.press('Escape')
  page.screenshot(path=str(out/f'chat-{w}.png'))
  page.locator('#rail-chats').click();page.wait_for_timeout(250);page.screenshot(path=str(out/f'overview-{w}.png'))
  assert not errors,(w,errors)
  page.close()
 b.close()
print('PASS: 11 responsive layouts, real conversation filtering/selection/sending, member details and permissions, pins, GIF/shared media, tools, settings, drawer focus and console checks.')
