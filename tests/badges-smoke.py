"""Badge artwork, alias rendering, accessible descriptions and profile-specific visibility."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
IDS=['admin','moderator','developer','beta','early-access','featured']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 # Artwork contact sheet is rendered at production, 64, 32 and 24 pixels.
 page=make_page(browser,ROOT,1200,1000);page.goto('http://localhost:8124/index.html')
 page.set_content('<html><body style="margin:0;background:#101b17;color:#edf3e9;font:14px system-ui;padding:24px"><h1>LYRIA badge family</h1>'+''.join('<section style="display:flex;gap:24px;align-items:center;margin:20px 0"><b style="width:70px">'+str(size)+'px</b>'+''.join('<div style="text-align:center;width:150px"><img width="'+str(size)+'" height="'+str(size)+'" src="http://localhost:8124/assets/badges/'+id+'.svg"><p>'+id+'</p></div>' for id in IDS)+'</section>' for size in [128,64,32,24])+'</body></html>')
 page.wait_for_function('[...document.images].every(i=>i.complete && i.naturalWidth>0)');page.screenshot(path=str(ROOT/'test-artifacts/badge-family.png'),full_page=True);page.close()
 for width in [320,390,768,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script("__testData.get('users/test-member').badges=['Admin','admin','Mod','moderator','DevBadge','developer','Beta','beta','EarlyAccess','early-access','feature','featured','VIP','unknown'];__testData.get('users/maya').badges=['Mod','Beta'];")
  page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  page.wait_for_function("document.querySelector('.message-badges[data-user-id=\"test-member\"]')?.children.length===6")
  assert page.locator('.message-badges img').first.evaluate('el=>el.width')==20
  page.locator('#user-profile-trigger').evaluate('(el)=>el.click()');page.wait_for_selector('#profile-modal .lyria-badge')
  page.wait_for_function("document.activeElement.id==='close-profile-modal'")
  assert page.locator('#badge-tooltip').count()==0 or page.locator('#badge-tooltip').is_hidden()
  assert page.locator('#call-profile-user').is_hidden()
  assert page.locator('#profile-modal-badges button').count()==6
  assert page.locator('#profile-modal-badges [data-badge-id=admin]').count()==1
  page.wait_for_function("[...document.querySelectorAll('#profile-modal-badges img')].every(i=>i.complete && i.naturalWidth>0)")
  admin=page.locator('#profile-modal-badges [data-badge-id=admin]')
  admin.focus();page.wait_for_selector('#badge-tooltip:not([hidden])');assert 'Official LYRIA administrator.' in page.locator('#badge-tooltip').inner_text()
  assert admin.get_attribute('aria-describedby')=='badge-tooltip'
  page.keyboard.press('Escape');assert page.locator('#badge-tooltip').is_hidden();assert page.locator('#profile-modal').is_visible()
  moderator=page.locator('#profile-modal-badges [data-badge-id=moderator]');moderator.click()
  assert 'safe and welcoming' in page.locator('#badge-tooltip').inner_text()
  box=page.locator('#badge-tooltip').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
  page.locator('#profile-modal-name').click();assert page.locator('#badge-tooltip').is_hidden()
  moderator.click();moderator.click();assert page.locator('#badge-tooltip').is_hidden()
  if width>=768:
   admin.hover();assert page.locator('#badge-tooltip').is_visible()
   page.mouse.move(0,0)
  page.evaluate("document.body.classList.add('contrast-mode')");admin.focus();assert page.locator('#badge-tooltip').is_visible()
  page.keyboard.press('Escape');page.keyboard.press('Escape')
  # A normal member can hide only their own badges, not another person's badges.
  page.locator('#settings-btn').evaluate('(el)=>el.click()');page.locator('#badge-visibility-toggle').uncheck()
  page.wait_for_function("document.getElementById('badges-save-status').dataset.state==='saved'")
  assert page.locator('.message-badges[data-user-id=test-member] button').count()==0
  assert page.locator('.message-badges[data-user-id=maya] button').count()>0
  page.locator('#bio-input').fill('Profile still saves');page.locator('#update-bio-btn').click();page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='saved'")
  assert page.evaluate("__testData.get('users/test-member').badges").count('DevBadge')==1
  page.reload();page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  page.locator('#user-profile-trigger').evaluate('(el)=>el.click()');page.wait_for_selector('#profile-modal',state='visible');assert page.locator('#profile-badges-empty').inner_text()=='Badges hidden'
  page.screenshot(path=str(ROOT/f'test-artifacts/badge-profile-hidden-{width}.png'))
  assert not errors,(width,errors);page.close()
 # Missing artwork keeps a labelled, interactive badge, never a broken image or user-avatar substitution.
 page=make_page(browser,ROOT,390,844);page.add_init_script("__testData.get('users/test-member').badges=['Beta','DevBadge']")
 page.route('**/assets/badges/developer.svg',lambda route:route.fulfill(status=404,body=''))
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
 page.locator('#user-profile-trigger').evaluate('(el)=>el.click()');page.wait_for_selector('#profile-modal [data-asset-unavailable=true]')
 missing=page.locator('#profile-modal [data-badge-id=developer]');assert missing.locator('img').count()==0;assert missing.locator('.badge-fallback').inner_text()=='D'
 missing.click();assert 'build and maintain' in page.locator('#badge-tooltip').inner_text()
 page.close()
 # Light theme keeps the same recognizable dark tokens and readable descriptions.
 page=make_page(browser,ROOT,390,844);page.add_init_script("__testData.get('users/test-member').badges=['Mod','EarlyAccess']")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
 page.evaluate("LyriaAppearance.apply({mode:'light',hue:225,accent:'#3e55b8'})")
 page.locator('#user-profile-trigger').evaluate('(el)=>el.click()');page.wait_for_selector('#profile-modal .lyria-badge')
 page.locator('#profile-modal [data-badge-id=early-access]').focus();assert page.locator('#badge-tooltip').is_visible()
 page.screenshot(path=str(ROOT/'test-artifacts/badge-profile-light.png'))
 page.close();browser.close()
print('PASS: all badge art at 128/64/32/24px; legacy aliases, deduplication, compact chat, keyboard/tap descriptions, tooltip bounds, high contrast, per-profile visibility, reload/save and missing artwork on four layouts.')
