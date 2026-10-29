"""Run with python3 tests/ui-smoke.py after installing Python Playwright and Chromium.
All backend SDKs are replaced by an in-memory fixture. Production is never touched.
"""
from pathlib import Path
from html.parser import HTMLParser
import json, mimetypes, subprocess, re
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
PAGES = ['index.html','home.html','login.html','News.html','inbox.html']
SIZES = [(320,568),(390,844),(768,1024),(667,375),(1024,768),(1440,1000)]
OUTPUT=ROOT/'test-artifacts'
OUTPUT.mkdir(exist_ok=True)

class Structure(HTMLParser):
    def __init__(self): super().__init__();self.ids=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id'])
for name in PAGES:
    text=(ROOT/name).read_text();parser=Structure();parser.feed(text)
    assert len(parser.ids)==len(set(parser.ids)), f'Duplicate IDs in {name}'
    assert text.count('css/theme.css')==1
    assert not re.search('<style>|rel="stylesheet"[^>]+(?:main|chat|v6)',text)
    for script in re.finditer(r'<script([^>]*)>(.*?)</script>',text,re.S):
        if 'src=' in script[1]:continue
        checked=subprocess.run(['node','--check','--input-type=module'],input=script[2],text=True,capture_output=True)
        assert checked.returncode==0,(name,checked.stderr)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    def make_page(width=390,height=844,touch=True):
        page=browser.new_page(viewport={'width':width,'height':height},has_touch=touch)
        page.add_init_script(path=str(ROOT/'tests/firebase-fixture.js'))
        release=json.loads((ROOT/'js/releases.json').read_text())['releases'][0]['id']
        page.add_init_script("try{localStorage.setItem('lyria:release-seen',"+json.dumps(release)+")}catch{}")
        page.add_init_script("if(location.pathname.endsWith('login.html'))firebase.auth().onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}}")
        def route(r):
            url=r.request.url
            if url.startswith('http://localhost:8124/'):
                file=ROOT/url.split('8124/')[1].split('?')[0]
                if file.is_file():r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
                else:r.fulfill(status=404,body='')
            elif 'www.gstatic.com/firebasejs/' in url and not '-compat' in url:
                names={'firebase-app.js':['initializeApp'],'firebase-auth.js':['getAuth','onAuthStateChanged'],'firebase-firestore.js':['initializeFirestore','getFirestore','doc','increment','onSnapshot','setDoc','getDoc','collection','addDoc','query','orderBy','getDocs','limit','startAfter','runTransaction']}.get(url.split('/')[-1],[])
                r.fulfill(body='\n'.join('export const '+name+'=window.__firebaseModule.'+name+';' for name in names),content_type='text/javascript')
            elif ('www.gstatic.com/firebasejs/' in url and '-compat.js' in url) or 'cdnjs.cloudflare.com/ajax/libs/peerjs/' in url:r.fulfill(body='/* SDK supplied by fixture. */',content_type='text/javascript')
            else:r.abort()
        page.route('**/*',route)
        return page
    count=0
    for width,height in SIZES:
        page=make_page(width,height,width<=768)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        for name in PAGES:
            errors.clear();page.goto('http://localhost:8124/'+name+('?channel=community' if name=='home.html' else ''),wait_until='load');page.wait_for_timeout(150)
            assert not errors,(name,width,errors)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(name,width,'horizontal overflow')
            clipped=page.evaluate('''() => [...document.querySelectorAll('button,input,textarea,.wrapper,.container')].filter(el=>{
                const r=el.getBoundingClientRect();return r.width&&r.height&&!el.closest('.sidebar,.modal,.product-stage,.journal-filters')&&(r.left<-1||r.right>innerWidth+1)
            }).map(el=>el.id||el.className)''')
            assert not clipped,(name,width,'clipped controls',clipped)
            if name=='home.html':
                assert page.locator('.message').count()==3
                box=page.locator('.message-input').bounding_box();assert box['y']+box['height']<=height+1,(width,box)
            if width in [390,1440]:page.screenshot(path=str(OUTPUT/f'{name}-{width}.png'),full_page=True)
            count+=1
        page.close()
    page=make_page()
    page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');page.wait_for_timeout(150)
    page.locator('#header-menu-toggle').click();assert page.locator('#header-menu-toggle').get_attribute('aria-expanded')=='true'
    page.locator('#settings-btn').click();page.wait_for_timeout(60)
    assert page.locator('#settings-modal').get_attribute('aria-hidden')=='false'
    page.locator('#logout-btn').focus();page.keyboard.press('Tab');assert page.locator('#close-modal').evaluate('el=>el===document.activeElement')
    page.keyboard.press('Escape');page.wait_for_timeout(60)
    assert page.locator('#settings-modal').get_attribute('aria-hidden')=='true'
    assert page.locator('#header-menu-toggle').evaluate('el=>el===document.activeElement')
    page.locator('#message-input').fill('A message with <script>literal text</script>')
    page.locator('#send-button').click();page.wait_for_timeout(150)
    assert page.locator('.message').count()==4
    assert page.locator('#message-input').input_value()==''
    assert page.locator('.message-content').last.inner_text()=='A message with <script>literal text</script>'
    page.evaluate('window.__failNextMessage=true');page.locator('#message-input').fill('Keep this draft')
    page.locator('#send-button').click();page.wait_for_timeout(100)
    assert page.locator('#message-input').input_value()=='Keep this draft'
    assert page.locator('#send-button').is_enabled()
    page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,value:360});visualViewport.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(100);box=page.locator('.message-input').bounding_box();assert box['y']+box['height']<=361
    page.close()
    page=make_page(1440,1000,False);page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');page.wait_for_timeout(100)
    page.locator('#add-channel').click();page.wait_for_timeout(50)
    page.locator('#channel-action-input').fill('Design notes');page.locator('#submit-channel-action').click();page.wait_for_timeout(150)
    assert page.locator('#channel-title').inner_text()=='Design notes'
    assert page.locator('.channel-btn.active-channel').inner_text()=='Design notes'
    page.locator('#settings-btn').click();page.wait_for_timeout(50);page.locator('#toggle-dark-mode').click();page.wait_for_function("document.body.classList.contains('contrast-mode')");assert page.locator('#contrast-save-status').inner_text()=='Saved to your account.'
    page.keyboard.press('Escape');page.wait_for_timeout(50)
    page.locator('#open-friends-modal').click();page.wait_for_timeout(100);assert 'Maya Chen' in page.locator('#friends-list').inner_text()
    page.close()
    # Account data is authoritative in Firestore, and save feedback must reflect confirmation.
    page=make_page(1440,1000,False);page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');page.wait_for_timeout(100)
    assert page.locator('#channel-title').inner_text()=='Everyone'
    assert page.evaluate('window.__firestoreTransport.experimentalForceLongPolling') is True
    assert page.locator('[data-channel-id="community"]').count()==1
    assert page.locator('#leave-channel').is_disabled()
    page.locator('#settings-btn').click();page.wait_for_timeout(50)
    page.evaluate('window.__failAuthProfile=true')
    page.locator('#display-name-input').fill('Saved Name');page.locator('#update-display-name').click()
    page.wait_for_function("document.getElementById('display-name-save-status').dataset.state==='saved'")
    assert page.locator('#user-name').inner_text()=='Saved Name'
    page.evaluate('window.__failNextProfileSave=true');page.locator('#bio-input').fill('Keep my unsaved bio');page.locator('#update-bio-btn').click()
    page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='error'")
    assert 'Not saved.' in page.locator('#bio-save-status').inner_text()
    assert page.locator('#bio-input').input_value()=='Keep my unsaved bio'
    assert page.evaluate("window.__testData.get('users/test-member').bio")!='Keep my unsaved bio'
    page.evaluate('window.__delayProfileSave=true');page.locator('#update-bio-btn').click();page.wait_for_timeout(50)
    assert page.locator('#bio-save-status').get_attribute('data-state')=='saving'
    assert page.locator('#update-bio-btn').is_disabled()
    page.locator('#bio-input').fill('A newer unsaved edit')
    page.evaluate('window.__delayProfileSave=false;window.__finishProfileSave()')
    page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='dirty'")
    assert page.locator('#bio-input').input_value()=='A newer unsaved edit'
    page.locator('#update-bio-btn').click();page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='saved'")
    page.reload(wait_until='load');page.wait_for_timeout(100)
    assert page.locator('#user-name').inner_text()=='Saved Name'
    page.wait_for_selector('#settings-modal[data-ui-open=true]')
    assert page.locator('#bio-input').input_value()=='A newer unsaved edit'
    page.evaluate("window.__testData.delete('users/test-member')")
    page.locator('#bio-input').fill('Restored missing profile');page.locator('#update-bio-btn').click()
    page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='saved'")
    assert page.evaluate("window.__testData.get('users/test-member').bio")=='Restored missing profile'
    page.close()
    page=make_page();page.goto('http://localhost:8124/News.html?story=archive-status-feature',wait_until='load');page.wait_for_timeout(100)
    like=page.locator('[id$="-like-button"]').first;like.click();page.wait_for_timeout(100);assert like.get_attribute('aria-pressed')=='true'
    assert like.locator('svg').count()==1
    like.click();page.wait_for_timeout(80);assert like.get_attribute('aria-pressed')=='false'
    page.locator('#comment-input-status-feature').fill('A new chapter for the community.')
    page.locator('.journal-comment-form button').click();page.wait_for_timeout(100)
    assert 'A new chapter for the community.' in page.locator('#comments-list-status-feature').inner_text()
    page.evaluate("window.__testData.set('userArticles/test',{title:'<img src=x onerror=alert(1)>',body:'A story',authorName:'<b>Author</b>',tags:['<script>'],timestamp:new Date().toISOString()});window.__emitFixture()")
    page.locator('.journal-back').click();page.wait_for_timeout(80);assert page.locator('.user-submitted').count()==1
    assert page.locator('.user-submitted :is(h2,h3)').inner_text()=='<img src=x onerror=alert(1)>'
    assert page.locator('.user-submitted :is(h2,h3) img').count()==0
    page.evaluate('window.__emitFixture()');page.wait_for_timeout(80);assert page.locator('.user-submitted').count()==1
    page.close()
    for button in ['#guest-login','#google-signin']:
        page=make_page();page.add_init_script("if(location.pathname.endsWith('login.html'))firebase.auth().onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}}");page.goto('http://localhost:8124/login.html',wait_until='load');page.locator(button).click();page.wait_for_url('**/home.html?view=hub');page.close()
    # A stalled HTTPS request must release the save button and expose recovery.
    page=make_page(1440,1000,False);page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');page.wait_for_timeout(100)
    page.locator('#settings-btn').click();page.wait_for_timeout(50);page.clock.install()
    page.evaluate('window.__stallAccount=true');page.locator('#bio-input').fill('Keep this after a timeout');page.locator('#update-bio-btn').click()
    page.clock.fast_forward(16000)
    page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='error'")
    assert page.locator('#update-bio-btn').is_enabled()
    assert page.locator('#bio-input').input_value()=='Keep this after a timeout'
    assert page.locator('#reconnect-account').is_visible()
    page.evaluate('window.__stallAccount=false');page.locator('#reconnect-account').click()
    page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
    assert page.locator('#bio-input').input_value()=='Keep this after a timeout'
    page.reload(wait_until='load');page.wait_for_selector('#settings-modal[data-ui-open=true]')
    assert page.locator('#bio-input').input_value()=='Keep this after a timeout'
    assert page.locator('#bio-input').get_attribute('data-dirty')=='true'
    page.locator('#update-bio-btn').click();page.wait_for_function("document.getElementById('bio-save-status').dataset.state==='saved'")
    page.close()
    page=make_page();page.add_init_script('window.__denyCommunity=true');page.goto('http://localhost:8124/home.html?channel=community',wait_until='load')
    page.wait_for_function("document.getElementById('channel-title').textContent==='My personal channel'")
    assert page.locator('[data-channel-id="community"]').count()==1
    page.close()
    browser.close()
print(f'PASS: {count} responsive page checks; structure, dialogs, channels, messaging success/failure, keyboard viewport, friends, icons, account save/reload/error/pending states, shared-room fallback, likes and comments.')
