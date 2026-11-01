from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [320,390,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_selector('.message-reactions');page.wait_for_selector('[data-channel-id=studio]',state='attached');page.evaluate("document.querySelector('[data-channel-id=studio]').click()")
  page.evaluate("__testData.set('channels/studio/messages/react',{senderId:'maya',sender:'Maya',message:'React here',timestamp:{toDate:()=>new Date()}});document.querySelector('[data-channel-id=community]').click();document.querySelector('[data-channel-id=studio]').click()")
  page.wait_for_selector('.message-reactions')
  message=page.locator('.message').first
  message.locator('summary').click();message.get_by_role('button',name='Love',exact=True).click()
  page.wait_for_function("document.querySelector('.message-reactions>button[aria-pressed=true]')")
  assert message.get_by_role('button',name='Love: 1. Remove your reaction').count()==1
  message.get_by_role('button',name='Love: 1. Remove your reaction').click()
  page.wait_for_function("!document.querySelector('.message-reactions>button[aria-pressed]')")
  page.evaluate("__failCommit=true")
  message.locator('summary').click();message.get_by_role('button',name='Fire',exact=True).click()
  page.wait_for_function("document.body.textContent.includes('Reaction wasn’t saved')")
  assert message.locator('.message-reactions>button[aria-pressed]').count()==0
  assert message.get_by_role('button',name='Report message from Maya').count()==1
  page.evaluate("__failCommit=false")
  message.locator('summary').click();message.get_by_role('button',name='Sparkles',exact=True).click()
  page.wait_for_function("document.querySelector('.message-reactions .super-reaction')")
  page.evaluate("document.getElementById('open-room-profile').click()");page.locator('#room-profile-name').fill('Studio Alex');page.locator('#room-profile-bio').fill('Creating in this room.');page.locator('#save-room-profile').click()
  try: page.wait_for_function("document.getElementById('room-profile-status').textContent.includes('Saved for this conversation')")
  except Exception:
   raise AssertionError({'profileStatus':page.locator('#room-profile-status').text_content(),'errors':errors,'data':page.evaluate("__testData.get('channels/studio/memberProfiles/test-member')")})
  page.locator('#close-room-profile').click();page.locator('#composer-sticker').click();page.get_by_role('button',name='Send sticker: Hello').click()
  page.wait_for_function("document.querySelector('.sticker-message') && document.body.textContent.includes('Studio Alex')")
  page.evaluate("document.querySelector('[data-channel-id=personal-test-member]').click()")
  page.wait_for_function("document.querySelector('.chat-area').dataset.selectedChannelId==='personal-test-member'")
  page.evaluate("LyriaUI.openModal(document.getElementById('conversation-settings-modal'))")
  page.locator('#room-description').fill('My colorful private corner.');page.locator('#room-accent').select_option('#c5a3ff');page.locator('#room-icon').select_option('🎨');page.locator('#room-banner-style').select_option('grid');page.locator('#room-sticker-pack').select_option('critters');page.locator('#save-room-appearance').click()
  page.wait_for_function("document.getElementById('room-appearance-status').textContent.includes('saved')")
  assert page.evaluate("__testData.get('channels/personal-test-member').stickerPack")=='critters'
  page.evaluate("LyriaUI.closeModal(document.getElementById('conversation-settings-modal'));LyriaUI.openModal(document.getElementById('settings-modal'))")
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
print('PASS: responsive appearance, per-room profiles, community styling, stickers, expanded reactions, reload, and failure feedback.')
