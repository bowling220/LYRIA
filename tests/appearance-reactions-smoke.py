from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [320,390,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/home.html');page.wait_for_selector('.message-reactions');page.wait_for_selector('[data-channel-id=studio]',state='attached');page.evaluate("document.querySelector('[data-channel-id=studio]').click()")
  page.evaluate("__testData.set('channels/studio/messages/react',{senderId:'maya',sender:'Maya',message:'React here',timestamp:{toDate:()=>new Date()}});document.querySelector('[data-channel-id=community]').click();document.querySelector('[data-channel-id=studio]').click()")
  page.wait_for_selector('.message-reactions')
  message=page.locator('.message').first
  message.locator('summary').click();message.get_by_role('button',name='Love',exact=True).click()
  page.wait_for_function("document.querySelector('.message-reactions>button[aria-pressed=true]')")
  assert message.get_by_role('button',name='Love: 1. Remove your reaction').count()==1
  message.get_by_role('button',name='Love: 1. Remove your reaction').click()
  page.wait_for_function("!document.querySelector('.message-reactions>button')")
  page.evaluate("__failCommit=true")
  message.locator('summary').click();message.get_by_role('button',name='Fire',exact=True).click()
  page.wait_for_function("document.body.textContent.includes('Reaction wasn’t saved')")
  assert message.locator('.message-reactions>button').count()==0
  page.evaluate("__failCommit=false;LyriaUI.openModal(document.getElementById('settings-modal'))")
  page.get_by_role('button',name='Midnight',exact=True).click()
  assert page.evaluate('LyriaAppearance.get().hue')==235
  page.locator('#theme-mode').select_option('light');page.locator('#theme-save').click()
  page.wait_for_function("document.getElementById('theme-save-status').textContent==='Saved to your account.'")
  page.reload();page.wait_for_function("document.documentElement.dataset.appearance==='light'")
  assert page.evaluate('LyriaAppearance.get().hue')==235
  page.goto('http://localhost:8124/News.html');page.wait_for_function("document.documentElement.dataset.appearance==='light'")
  assert page.evaluate('LyriaAppearance.get().hue')==235
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: mobile/desktop theme save, reload, cross-page appearance, reaction add/remove, and failed-save feedback.')
