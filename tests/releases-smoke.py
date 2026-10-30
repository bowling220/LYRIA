"""Release welcome, real readiness, durable dismissal and existing panel/navigation state."""
from pathlib import Path
import json
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1];release=json.loads((ROOT/'js/releases.json').read_text())['releases'][0]['id']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width,height in [(320,480),(320,568),(390,844),(667,375),(768,1024),(1440,1000)]:
  page=make_page(browser,ROOT,width,height,release_seen=False);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/home.html?channel=studio');page.wait_for_selector('#release-modal[data-ui-open=true]');page.wait_for_selector('#release-changes',state='visible')
  assert page.locator('.release-change').count()==1
  output=ROOT/'test-artifacts';output.mkdir(parents=True,exist_ok=True)
  page.screenshot(path=str(output/f'whats-new-{width}x{height}.png'))
  page.locator('#release-dots button').nth(1).focus();page.keyboard.press('Enter')
  assert page.locator('#release-dots button[aria-current=true]').evaluate('el=>el===document.activeElement')
  page.locator('#release-dots button').first.click()
  page.locator('#release-change-next').click();assert 'Change 2 of' in page.locator('#release-change-page').inner_text()
  page.locator('#release-info-toggle').click()
  assert 'GIF search: key not included' in page.locator('#release-build').inner_text()
  assert page.locator('#release-details').is_visible()
  assert page.locator('.release-content').evaluate('el=>el.scrollHeight<=el.clientHeight+1'),(width,height,'version details overflow')
  page.locator('#release-info-toggle').click()
  assert page.locator('.release-content').evaluate('el=>el.scrollHeight<=el.clientHeight+1'),(width,height,page.locator('.release-content').evaluate('el=>[el.scrollHeight,el.clientHeight]'))
  assert page.locator('#release-continue').bounding_box()['y']+page.locator('#release-continue').bounding_box()['height']<=height
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert 'channel=studio' in page.url
  if (width,height) in [(320,480),(667,375)]:
   for index,entry in enumerate(json.loads((ROOT/'js/releases.json').read_text())['releases']):
    page.locator('#release-select').select_option(str(index))
    for change in range(len(entry['changes'])):
     if change:page.locator('#release-change-next').click()
     assert page.locator('.release-content').evaluate('el=>el.scrollHeight<=el.clientHeight+1'),(width,height,entry['id'],change)
     assert page.locator('#release-modal .close-button').evaluate('el=>el.contains(document.elementFromPoint(el.getBoundingClientRect().x+el.clientWidth/2,el.getBoundingClientRect().y+el.clientHeight/2))'),(width,height,'close button covered')
   page.locator('#release-select').select_option('0')
   page.locator('#release-change-next').click()
  page.screenshot(path='/tmp/lyria-update-'+str(width)+'.png')
  page.locator('#release-continue').click();page.wait_for_selector('#release-modal[data-ui-open=false]',state='attached')
  assert page.evaluate("localStorage.getItem('lyria:release-seen')")==release
  page.reload();page.wait_for_selector('.message-input',state='visible');page.wait_for_timeout(150)
  assert page.locator('#release-modal[data-ui-open=true]').count()==0
  if width<=768:page.locator('#header-menu-toggle').click()
  page.locator('[data-open-release]').click();page.wait_for_selector('#release-changes',state='visible');page.locator('#release-select').select_option('1');assert page.locator('#release-title').inner_text()==json.loads((ROOT/'js/releases.json').read_text())['releases'][1]['title'];page.locator('#release-select').select_option('0')
  page.keyboard.press('Escape');page.wait_for_selector('#release-modal[data-ui-open=false]',state='attached')
  assert not errors,errors
  page.close()
 # Loading follows the real channel request; timeout shows notes and permits entry without claiming connectivity.
 page=make_page(browser,ROOT,390,844,release_seen=False);page.add_init_script('window.__stallRestQueries=true')
 page.goto('http://localhost:8124/home.html?view=hub');page.wait_for_selector('#release-loading',state='visible');page.clock.install();page.clock.fast_forward(8500);page.wait_for_selector('#release-changes',state='visible')
 assert 'still connecting' in page.locator('#release-footer-note').inner_text()
 page.locator('#release-continue').click();assert page.locator('#community-sidebar').is_visible();page.close()
 # Existing restored panels take precedence over an announcement.
 page=make_page(browser,ROOT,1440,1000,release_seen=False);page.add_init_script("sessionStorage.setItem('lyria:panels:/home.html:test-member',JSON.stringify([{id:'settings-modal'}]))")
 page.goto('http://localhost:8124/home.html');page.wait_for_selector('#settings-modal[data-ui-open=true]');assert page.locator('#release-modal[data-ui-open=true]').count()==0
 page.keyboard.press('Escape');page.locator('[data-open-release]').click();page.wait_for_selector('#release-changes',state='visible');page.close()
 # Already-seen users can read the changelog from News without moving the article.
 page=make_page(browser,ROOT);page.goto('http://localhost:8124/News.html?story=archive-status-feature');page.wait_for_selector('#reader-title');page.locator('[data-open-release]').click();page.wait_for_selector('#release-changes',state='visible');page.keyboard.press('Escape');assert 'story=archive-status-feature' in page.url;page.close()
 # A new release ID is announced even when an older release was acknowledged.
 page=make_page(browser,ROOT,release_seen=False);page.add_init_script("if(!localStorage.getItem('lyria:release-seen'))localStorage.setItem('lyria:release-seen','previous-release')")
 page.goto('http://localhost:8124/home.html');page.wait_for_selector('#release-modal[data-ui-open=true]');page.locator('#release-continue').click();page.reload();page.wait_for_selector('#channels-list .channel-btn');page.wait_for_timeout(100);assert page.locator('#release-modal[data-ui-open=true]').count()==0;page.close()
 # Unavailable metadata does not block LYRIA; manual retry recovers.
 page=make_page(browser,ROOT,1440,1000);page.route('**/js/releases.json',lambda r:r.fulfill(status=503,body='Unavailable'))
 page.goto('http://localhost:8124/home.html');page.wait_for_selector('#channels-list .channel-btn');page.locator('[data-open-release]').click();page.wait_for_selector('#release-error',state='visible');assert page.locator('#release-continue').is_enabled()
 page.unroute('**/js/releases.json');page.locator('#release-retry').click();page.wait_for_selector('#release-changes',state='visible');page.close()
 # If browser storage is blocked, skip automatic announcements but keep manual notes usable.
 page=make_page(browser,ROOT,1440,1000,release_seen=False);page.add_init_script("const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('lyria:release'))throw new DOMException('Storage restricted','SecurityError');return original.call(this,key,value)};")
 page.goto('http://localhost:8124/home.html');page.wait_for_selector('#channels-list .channel-btn');page.wait_for_timeout(100);assert page.locator('#release-modal[data-ui-open=true]').count()==0;page.locator('[data-open-release]').click();page.wait_for_selector('#release-changes',state='visible');page.locator('#release-continue').click();page.close()
 browser.close()
print('PASS: six welcome layouts, all published changes on small screens, keyboard step navigation, version details, no dialog scrolling, once-per-release dismissal, real loading/retry, saved panels/room, News retention and storage failures.')
