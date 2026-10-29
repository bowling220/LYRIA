"""Reload preserves the current page and selected room without granting membership."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [390,1280]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("window.__stallChannelMetadata=true;__testData.get('channels/studio').name='Test';")
  page.goto('http://localhost:8124/home.html')
  page.wait_for_selector('[data-channel-id=studio]')
  for room,title in [('studio','Test'),('personal-test-member','My personal channel'),('community','Everyone'),('studio','Test')]:
   if width<769:page.locator('#header-menu-toggle').click()
   page.locator('[data-channel-id="'+room+'"]').click()
   assert 'channel='+room in page.url
   page.reload()
   page.wait_for_function("document.getElementById('channel-title').dataset.selectedChannelId==="+repr(room))
   assert page.locator('#channel-title').inner_text()==title
   assert page.locator('[data-channel-id="'+room+'"]').get_attribute('aria-current')=='true'
  page.goto('http://localhost:8124/News.html');page.reload();assert page.url.endswith('News.html')
  page.goto('http://localhost:8124/inbox.html');page.reload();assert page.url.endswith('inbox.html')
  page.goto('http://localhost:8124/home.html?channel=missing-room')
  page.wait_for_function("document.querySelector('.chat-area').dataset.view==='hub'")
  # An existing private room without membership cannot be selected by URL or storage.
  page.add_init_script("__testData.set('channels/closed',{name:'Closed',members:['someone-else']});")
  page.goto('http://localhost:8124/home.html?channel=closed')
  page.wait_for_function("document.querySelector('.chat-area').dataset.view==='hub'")
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: current page stays put; mobile/desktop room and title survive repeated reloads; Everyone stays selected when chosen; inaccessible/deleted rooms cannot restore.')
