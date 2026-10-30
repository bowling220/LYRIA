from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [390,1280]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""const at=Date.parse('2026-10-29T10:00:00Z');__testData.set('users/test-member/readState/studio',{at});for(let i=0;i<20;i++)__testData.set('channels/studio/messages/unread-'+i,{senderId:'maya',sender:'Maya Chen',message:'Unread note '+i+' '+('A proper conversation. '.repeat(8)),mentions:i<2?['test-member']:[],timestamp:{toDate:()=>new Date(at+60000+i*1000),toMillis:()=>at+60000+i*1000}});""")
  page.goto('http://localhost:8124/home.html?channel=community')
  page.wait_for_function("document.querySelector('[data-channel-id=studio] .channel-unread')?.textContent==='@ 20'")
  # Keyboard mention selection inserts text; it must not submit a message.
  page.locator('#message-input').fill('@Ma');page.wait_for_selector('#mention-suggestions:not([hidden])');page.keyboard.press('Enter')
  assert page.locator('#message-input').input_value()=='@Maya Chen '
  assert page.locator('.message').count()==3
  page.locator('#message-input').fill('@Maya Chen hello');page.locator('#send-button').click()
  page.wait_for_function("[...__testData.values()].some(v=>v.message==='@Maya Chen hello' && v.mentions?.includes('maya'))")
  if width<769:page.locator('#header-menu-toggle').click()
  page.locator('[data-channel-id=studio]').click();page.wait_for_selector('#first-unread-marker')
  assert page.locator('.message-mentioned').count()==2
  page.locator('#jump-first-unread').click();page.locator('#mark-room-read').click()
  page.wait_for_function("!document.querySelector('[data-channel-id=studio] .channel-unread')")
  page.wait_for_function("__testData.get('users/test-member/readState/studio')?.at>Date.parse('2026-10-29T10:00:00Z')")
  page.reload();page.wait_for_function("document.getElementById('channel-title').dataset.selectedChannelId==='studio'")
  assert page.locator('#first-unread-marker').count()==0
  assert not errors,errors
  page.close()
 # First-unread navigation fetches an earlier window rather than pretending latest=first.
 page=make_page(browser,ROOT,1280,900)
 page.add_init_script("""const at=Date.parse('2026-10-29T10:00:00Z');__testData.set('users/test-member/readState/studio',{at});for(let i=0;i<120;i++)__testData.set('channels/studio/messages/window-'+i,{senderId:'maya',sender:'Maya Chen',message:'Window note '+i+' '+('History. '.repeat(20)),timestamp:{toDate:()=>new Date(at+60000+i*1000),toMillis:()=>at+60000+i*1000}});""")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_selector('[data-channel-id=studio]');page.locator('[data-channel-id=studio]').click()
 page.wait_for_function("document.getElementById('messages').textContent.includes('Window note 119 ')")
 assert 'Window note 0 ' not in page.locator('#messages').inner_text()
 page.locator('#jump-first-unread').click();page.wait_for_function("document.getElementById('messages').textContent.includes('Window note 0 ')")
 assert 'Window note 119 ' not in page.locator('#messages').inner_text()
 assert page.locator('.message').count()==100
 page.reload();page.wait_for_function("document.getElementById('messages').textContent.includes('Window note 0 ')")
 assert 'view=unread' in page.url
 page.locator('#back-to-latest').click();page.wait_for_function("document.getElementById('messages').textContent.includes('Window note 119 ')");page.close()
 browser.close()
print('PASS: unread and mention counts, keyboard mention selection, first-unread jump, mark-read persistence/reload, and mobile/desktop layouts.')
