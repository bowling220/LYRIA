"""Selected room, heading, messages, sending, and voice agree even when SDK metadata hangs."""
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
 for width,height in [(390,844),(1280,960)]:
  page=make_page(browser,ROOT,width,height);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""window.__stallChannelMetadata=true;__testData.get('channels/studio').name='Test';__testData.set('channels/studio/messages/private',{sender:'Maya',senderId:'maya',message:'Only in Test',timestamp:{toDate:()=>new Date('2026-10-29T10:30:00Z')}});""")
  page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.querySelector('[data-channel-id=studio]')")
  def select(id):
   if width<=768:page.locator('#header-menu-toggle').click()
   page.locator('[data-channel-id="'+id+'"]').click()
  select('studio')
  assert page.locator('#channel-title').inner_text()=='Test'
  assert page.locator('#channel-title').get_attribute('data-selected-channel-id')=='studio'
  page.wait_for_function("document.getElementById('messages').textContent.includes('Only in Test')")
  assert 'Only in Test' in page.locator('#messages').inner_text()
  assert 'Welcome to your little corner' not in page.locator('#messages').inner_text()
  assert page.locator('#message-input').get_attribute('placeholder')=='Message #Test'
  assert page.locator('[data-channel-id=studio]').get_attribute('aria-current')=='true'
  page.locator('#message-input').fill('This belongs to Test');page.locator('#send-button').click()
  page.wait_for_function("[...__testData].some(([path,v])=>path.startsWith('channels/studio/messages/') && v.message==='This belongs to Test')")
  assert not page.evaluate("[...__testData].some(([path,v])=>path.startsWith('channels/community/messages/') && v.message==='This belongs to Test')")
  # Inspect the actual voice session synchronously, then cancel before any real service connection.
  voice=page.evaluate("""()=>{
   window.Peer=function(){};const context=new AudioContext(),stream=context.createMediaStreamDestination().stream;
   const joining=LyriaVoice.join('lounge',undefined,undefined,Promise.resolve(stream));
   const value={room:LyriaVoice.getSession().room,label:document.getElementById('voice-room-name').textContent};
   LyriaVoice.leave();joining.finally(()=>context.close());return value;
  }""")
  assert voice=={'room':'studio','label':'Test · Lounge'},voice
  for id,title in [('community','Everyone'),('personal-test-member','My personal channel'),('studio','Test'),('community','Everyone'),('studio','Test')]:
   select(id);assert page.locator('#channel-title').inner_text()==title
   assert page.locator('#channel-title').get_attribute('data-selected-channel-id')==id
  page.screenshot(path=str(ROOT/f'test-artifacts/channel-selection-{width}.png'))
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: selected Test title, composer, active row, message read/write paths, and voice target stay aligned with stalled metadata on mobile/tablet; repeated switches stay consistent.')
