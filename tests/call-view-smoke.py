"""Call-stage layout and controls over a local session fixture; no production access."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height in [(320,568),(390,844),(667,375),(768,1024),(1440,1000)]:
  page=make_page(browser,ROOT,width,height);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("__testData.get('channels/studio').name='Test'")
  page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.querySelector('[data-channel-id=studio]')")
  if width<=768:page.locator('#header-menu-toggle').click()
  page.locator('[data-channel-id=studio]').click()
  page.evaluate("""()=>{
   window.__viewSession={id:'v'+'a'.repeat(32),room:'studio',channel:'lounge',label:'Test · Lounge',status:'Connected · 2 people',startedAt:Date.now()-92000,joining:false,muted:false,audioMuted:false,microphoneState:'ready',participants:[{id:'v'+'a'.repeat(32),userId:'test-member',name:'Alex Morgan',self:true,muted:false,connected:true},{id:'v'+'b'.repeat(32),userId:'maya',name:'Maya Chen',self:false,muted:false,connected:true}]};
   window.__updateView=()=>window.dispatchEvent(new CustomEvent('lyria:voice-state',{detail:__viewSession}));
   LyriaVoice.getSession=()=>__viewSession;LyriaVoice.toggleAudio=()=>{__viewSession.audioMuted=!__viewSession.audioMuted;__updateView()};LyriaVoice.leave=()=>{__viewSession=null;__updateView();document.getElementById('voice-panel').hidden=true};
   document.getElementById('voice-panel').hidden=false;
   document.getElementById('voice-mute').addEventListener('click',()=>{__viewSession.muted=!__viewSession.muted;__viewSession.participants[0].muted=__viewSession.muted;__updateView()});__updateView();
  }""")
  assert page.locator('#call-stage').is_visible() and page.locator('#message-input').is_hidden()
  assert page.locator('.call-person').count()==2
  assert page.locator('#call-stage-title').inner_text()=='Test · Lounge'
  assert page.locator('#call-stage-duration').inner_text().startswith('01:')
  page.evaluate("window.dispatchEvent(new CustomEvent('lyria:voice-speaking',{detail:{sessionId:__viewSession.id,participantId:__viewSession.participants[1].id,speaking:true,level:.7}}))")
  assert page.locator('.call-person.is-speaking').count()==1
  for button in page.locator('.call-dock button').all():
   box=button.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height+1,(width,height,box)
  assert page.locator('#call-stage').bounding_box()['height']>100
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(ROOT/f'test-artifacts/call-stage-{width}.png'))
  page.locator('#call-stage-mute').click();assert page.locator('#call-stage-mute').get_attribute('aria-pressed')=='true'
  assert page.locator('.call-person[data-self=true]').get_attribute('data-muted')=='true'
  page.locator('#call-stage-sound').click();assert page.locator('#call-stage-sound').get_attribute('aria-pressed')=='true'
  page.locator('#call-stage-chat').click();assert page.locator('#message-input').is_visible() and page.evaluate('__viewSession!==null')
  page.locator('#voice-open-view').click();assert page.locator('#call-stage').is_visible()
  # Six members remain scrollable while the dock stays on screen.
  page.evaluate("()=>{for(let i=0;i<4;i++)__viewSession.participants.push({id:'person-'+i,userId:'extra-'+i,name:['Jordan Ellis','Sam Rivera','Kai Thompson','Taylor Reed'][i],self:false,muted:i===2,connected:true});__updateView()}")
  assert page.locator('.call-person').count()==6
  box=page.locator('.call-dock').bounding_box();assert box['y']+box['height']<=height+1
  page.screenshot(path=str(ROOT/f'test-artifacts/call-stage-six-{width}.png'))
  # Animated profile images do not reload on every ordinary session update.
  page.evaluate("()=>{__testData.set('profiles/maya-gif',{displayName:'Maya Chen',photoURL:'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif'});__viewSession.participants[1].userId='maya-gif';__updateView()}")
  page.wait_for_function("document.querySelector('.call-person[data-self=false] img').getAttribute('src')?.includes('giphy.gif')")
  page.evaluate("()=>{window.__avatarChanges=0;new MutationObserver(records=>{__avatarChanges+=records.filter(r=>r.attributeName==='src').length}).observe(document.querySelector('.call-person[data-self=false] img'),{attributes:true});__updateView();__updateView()}")
  assert page.evaluate('__avatarChanges')==0
  page.locator('#call-stage-leave').click();assert page.locator('#call-stage').is_hidden() and page.locator('#message-input').is_visible()
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: call view on five screen sizes, speaking/mute indicators, two/six participant layouts, timer, dock controls, sound toggle, chat/call switching, and leaving.')
