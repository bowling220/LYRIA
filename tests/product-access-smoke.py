"""Universal profile access and safe ignored historical data, with no production writes."""
from pathlib import Path
import json,mimetypes
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
variants=[{}, {'isPremium':False,'premiumTier':'basic','subscriptionStatus':'expired'}, {'isPremium':True,'premiumTier':'premium','subscriptionStatus':'active'}, {'isPremium':{'unexpected':True},'premiumTier':['unknown'],'subscriptionStatus':None}]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [390,1440]:
  for index,legacy in enumerate(variants):
   page=make_page(browser,ROOT,width,900);errors=[];requests=[]
   page.on('pageerror',lambda error:errors.append(str(error)));page.on('request',lambda request:requests.append(request.url))
   page.add_init_script("Object.assign(__testData.get('users/test-member'),"+json.dumps({**legacy,'badges':['premium','Premium','supporter','subscriber','VIP','Beta','EarlyAccess'],'unrelated':{'keep':'yes'}})+");firebase.auth().currentUser.isAnonymous="+str(index==1).lower()+";")
   page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
   if width<768:page.locator('#header-menu-toggle').click()
   page.locator('#settings-btn').click()
   assert page.locator('#profile-image-input').is_enabled()
   assert page.locator('#profile-banner-input').is_enabled()
   assert page.locator('#choose-avatar-gif').is_enabled()
   assert page.locator('#choose-banner-gif').is_enabled()
   assert page.locator('#theme-save').is_enabled()
   assert not page.locator('[id*=premium],[class*=premium],a[href*=premium]').count()
   page.locator('#bio-input').fill('The full experience belongs to everyone')
   page.locator('#update-bio-btn').click();page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='saved'")
   for target,gif in [('avatar','wave'),('banner','fireworks')]:
    page.locator('#choose-'+target+'-gif').click();page.locator('[data-gif-id="'+gif+'"]').click()
    page.wait_for_function("!document.getElementById('gif-picker-action').disabled");page.locator('#gif-picker-action').click()
    save='update-profile-image' if target=='avatar' else 'update-profile-banner'
    status='image-save-status' if target=='avatar' else 'banner-save-status'
    page.locator('#'+save).click();page.wait_for_function("id=>document.getElementById(id).dataset.state==='saved'",arg=status)
   page.keyboard.press('Escape');page.locator('#open-friends-modal').evaluate('(el)=>el.click()')
   page.locator('#status-select').select_option('busy');page.locator('#update-status-btn').click()
   page.wait_for_function("document.getElementById('status-save-status').dataset.state==='saved'")
   stored=page.evaluate("__testData.get('users/test-member')")
   for key,value in legacy.items():assert stored[key]==value,(key,stored[key])
   assert stored['unrelated']=={'keep':'yes'}
   assert stored['friends']==['maya'] and stored['channels']==['personal-test-member','studio']
   # Close Friends through the actual UI before reloading; otherwise panel persistence
   # correctly restores it underneath the profile and blocks the later Send click.
   page.locator('#close-friends-modal').click()
   page.wait_for_function("document.getElementById('friends-modal').getAttribute('aria-hidden')==='true'")
   page.reload();page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
   page.locator('#user-profile-trigger').evaluate('(el)=>el.click()')
   page.wait_for_function("document.getElementById('profile-modal').style.display==='flex'")
   assert page.locator('#profile-modal-bio').inner_text()=='The full experience belongs to everyone'
   assert page.locator('#profile-modal-status').inner_text().lower()=='busy'
   assert page.locator('#profile-modal-badges [data-badge-name]').count()==2
   assert page.locator('#profile-modal-badges [data-badge-name="beta"]').count()==1
   assert 'giphy.gif' in page.locator('#profile-modal-image').get_attribute('src')
   assert 'giphy.gif' in page.locator('#profile-banner-image').get_attribute('src')
   page.keyboard.press('Escape');page.locator('#message-input').fill('Still chatting without a tier')
   page.locator('#send-button').click();page.wait_for_function("[...__testData.values()].some(v=>v.message==='Still chatting without a tier')")
   assert not any(any(domain in url for domain in ['googlesyndication','doubleclick','adsbygoogle','ca-pub-']) for url in requests)
   assert not errors,(width,index,errors)
   page.close()
 # Channel joining/leaving retain membership and other account data.
 page=make_page(browser,ROOT,1440,1000);page.add_init_script("__testData.set('channels/join-test',{id:'join-test',name:'Community workshop',createdBy:'maya',members:['maya']});__testData.set('channelInvites/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',{channelId:'join-test',name:'Community workshop',createdBy:'maya',expiresAt:null,revoked:false})")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
 page.locator('#join-channel').click();page.locator('#channel-action-input').fill('b'*32);page.locator('#submit-channel-action').click()
 page.wait_for_function("document.getElementById('channel-title').textContent==='Community workshop'")
 assert page.evaluate("__testData.get('channels/join-test').members.includes('test-member')")
 page.locator('#leave-channel').click();page.locator('#submit-channel-action').click()
 page.wait_for_function("document.querySelector('.chat-area').dataset.view==='hub'")
 assert not page.evaluate("__testData.get('channels/join-test').members.includes('test-member')")
 assert not page.evaluate("__testData.get('users/test-member').channels.includes('join-test')")
 assert page.evaluate("__testData.get('users/test-member').friends")==['maya']
 page.close()
 # A bookmarked retired address must navigate to the normal landing page, with no old UI.
 page=browser.new_page()
 def retired_route(route):
  if not route.request.url.startswith('http://localhost:8126/'):route.abort();return
  path=route.request.url.split('8126/')[1].split('?')[0] or 'index.html'
  file=ROOT/'dist/client'/path
  if file.is_file():route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
  else:route.fulfill(status=404,body='')
 page.route('**/*',retired_route);page.goto('http://localhost:8126/premium-upgrade.html')
 page.wait_for_url('http://localhost:8126/');page.wait_for_selector('.everyone-section')
 assert page.locator('#confirm-upgrade,.premium-plans').count()==0
 page.close();browser.close()
print('PASS: 8 mobile/desktop ordinary/guest/legacy profile cases; GIF avatars/banners, bios, statuses, badges, reload, preserved fields, messaging, no ad requests, channel join/leave.')
