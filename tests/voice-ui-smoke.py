"""Voice directory layout and presence checks using local files and fake accounts."""
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
 for width,height in [(320,568),(390,844),(667,375),(768,1024),(1440,1000)]:
  page=make_page(browser,ROOT,width,height)
  errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto('http://localhost:8124/home.html?channel=community')
  page.wait_for_function("document.querySelectorAll('#voice-channels button').length===3")
  page.evaluate("""()=>{
   const voice=(id,channel,displayName,muted=false)=>({sessionId:'v'+id.repeat(32),peerId:'lyria-v'+id.repeat(32),channel,displayName,muted,updatedAt:{toMillis:()=>Date.now()}});
   __testData.set('channels/community/typingStatus/maya',{voice:voice('a','gaming','Maya Chen',true)});
   __testData.set('channels/community/typingStatus/kai',{voice:voice('b','lounge','Kai')});__emitFixture();
  }""")
  if width<=768:page.locator('#header-menu-toggle').click()
  page.locator('#voice-channels').scroll_into_view_if_needed()
  assert 'Maya Chen · muted' in page.locator('#voice-channels').inner_text()
  assert page.locator('[data-voice-channel=gaming]').inner_text().endswith('1/6')
  assert page.locator('[data-voice-channel=quiet]').inner_text().endswith('0/6')
  for button in page.locator('#voice-channels button').all():
   box=button.bounding_box();assert box['height']>=44 and box['width']>100
   assert box['x']>=0 and box['x']+box['width']<=width
  page.locator('#voice-sound-effects').uncheck()
  assert page.evaluate("localStorage.getItem('lyria-voice-sounds')")=='off'
  page.screenshot(path=str(ROOT/f'test-artifacts/voice-directory-{width}.png'))
  page.locator('[data-channel-id=studio]').click()
  page.wait_for_function("!document.getElementById('voice-channels').textContent.includes('Maya')")
  assert 'This conversation' in page.locator('#voice-directory-label').inner_text()
  page.reload();page.wait_for_function("document.querySelectorAll('#voice-channels button').length===3")
  assert not page.locator('#voice-sound-effects').is_checked()
  page.evaluate("""()=>{
   document.getElementById('voice-panel').hidden=false;document.getElementById('voice-room-name').textContent='Everyone · Lounge';document.getElementById('voice-status').textContent='Your microphone was interrupted. Reconnect the microphone to speak.';
   document.getElementById('voice-mic-status').textContent='Your device paused the microphone.';
   document.getElementById('voice-participants').innerHTML='<li>You</li><li>Maya Chen</li><li>Kai</li><li>Alex</li><li>Sam</li><li>Jordan</li>';
   for(const id of ['voice-repair-mic','voice-retry','voice-enable-effects','voice-enable-sound'])document.getElementById(id).hidden=false;
  }""")
  box=page.locator('.message-input').bounding_box();assert box['y']+box['height']<=height+1,(width,height,box)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(ROOT/f'test-artifacts/voice-active-{width}.png'))
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: voice directory and active microphone-recovery controls on five screen sizes, channel counts, named/muted participants, conversation scoping, touch targets, and persisted sound preference.')
