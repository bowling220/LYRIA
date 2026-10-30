"""Tab/account-scoped panel restoration, real data refresh, and no automatic actions."""
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [390,1280]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/home.html')
  page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  page.wait_for_function("sessionStorage.getItem('lyria:panels:/home.html:test-member')!==null")
  # Keep a private room selected underneath each panel.
  if width<769:page.locator('#header-menu-toggle').click()
  page.locator('[data-channel-id=studio]').click()
  # Explicit field focus before the dialog's first animation frame must win.
  page.locator('#settings-btn').evaluate("el=>{el.click();queueMicrotask(()=>document.getElementById('bio-input').focus())}")
  page.wait_for_timeout(80)
  page.reload();page.wait_for_selector('#settings-modal[data-ui-open=true]')
  page.wait_for_function("document.activeElement.id==='bio-input'")
  assert page.locator('#channel-title').inner_text()=='The creative studio'
  page.keyboard.press('Escape');page.wait_for_function("document.getElementById('settings-modal').dataset.uiOpen==='false'")
  page.reload();page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  assert page.locator('#settings-modal').is_hidden()
  # Friends are fetched again, not stored as stale profile data.
  page.locator('#open-friends-modal').evaluate('(el)=>el.click()')
  page.wait_for_function("document.getElementById('friends-list').textContent.includes('Maya Chen')")
  page.wait_for_timeout(50);page.reload();page.wait_for_selector('#friends-modal[data-ui-open=true]')
  page.wait_for_function("document.getElementById('friends-list').textContent.includes('Maya Chen')")
  page.keyboard.press('Escape')
  # Opening a profile only restores that profile, not friend/call actions.
  page.locator('#user-profile-trigger').evaluate('(el)=>el.click()')
  page.wait_for_selector('#profile-modal[data-ui-open=true]')
  uid=page.locator('#profile-modal').get_attribute('data-user-id')
  page.wait_for_timeout(50);page.reload();page.wait_for_selector('#profile-modal[data-ui-open=true]')
  assert page.locator('#profile-modal').get_attribute('data-user-id')==uid
  assert page.evaluate("[...__testData].filter(([k])=>k.startsWith('friendRequests/')).length")==1
  page.keyboard.press('Escape')
  # The join/create form reopens with its draft, never submitting it on restoration.
  if width<769:page.locator('#header-menu-toggle').click()
  page.locator('#add-channel').click();page.locator('#channel-action-input').fill('Still just a draft')
  page.wait_for_timeout(50);page.reload();page.wait_for_selector('#channel-action-modal[data-ui-open=true]')
  assert page.locator('#channel-action-input').input_value()=='Still just a draft'
  assert not page.evaluate("[...__testData.values()].some(v=>v.name==='Still just a draft')")
  page.keyboard.press('Escape')
  # Library state reopens without sending a GIF.
  page.locator('#gif-button').click();page.locator('#gif-search').fill('cat');page.wait_for_timeout(50)
  page.reload();page.wait_for_selector('#gif-modal[data-ui-open=true]')
  assert page.locator('#gif-search').input_value()=='cat'
  assert page.evaluate("[...__testData.values()].filter(v=>v.type==='gif').length")==0
  page.keyboard.press('Escape')
  assert not errors,errors
  page.close()
 # Manual navigation during a delayed room read wins over saved panels.
 page=make_page(browser,ROOT,1280,900)
 page.add_init_script("""sessionStorage.setItem('lyria:panels:/home.html:test-member',JSON.stringify([{id:'settings-modal'}]));let api;Object.defineProperty(window,'LyriaDataAPI',{configurable:true,get:()=>api,set:value=>{api=value;const read=value.read;value.read=path=>path==='channels/studio'?new Promise(resolve=>{window.__finishRoom=()=>read(path).then(resolve)}):read(path)}});""")
 page.goto('http://localhost:8124/home.html?channel=studio')
 page.wait_for_function("typeof __finishRoom==='function' && document.querySelector('[data-channel-id=community]')")
 page.locator('#app-loading-modal[data-ui-open=true] .app-loading-skip').click()
 page.locator('[data-channel-id=community]').click();page.evaluate('__finishRoom()')
 page.wait_for_timeout(100)
 assert page.locator('#channel-title').inner_text()=='Everyone'
 assert page.locator('#settings-modal').is_hidden();page.close()
 # A different account's stored state is never applied.
 page=make_page(browser,ROOT)
 page.add_init_script("sessionStorage.setItem('lyria:panels:/home.html:someone-else',JSON.stringify([{id:'settings-modal'}]));")
 page.goto('http://localhost:8124/home.html');page.wait_for_function("sessionStorage.getItem('lyria:panels:/home.html:test-member')!==null")
 assert page.locator('#settings-modal').is_hidden();page.close();browser.close()
print('PASS: settings/focus, friends/refreshed data, profiles, draft forms, GIF searches, close-and-reload, retained room, and account isolation on mobile/desktop; no auto-submission.')
