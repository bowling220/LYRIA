"""GIF selection, display, animated appearance, persistence, and failure recovery."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
import base64
ROOT=Path(__file__).resolve().parents[1]
GIF=base64.b64decode((ROOT/'tests/fixtures/animated.gif.base64').read_text())
OUTPUT=ROOT/'test-artifacts';OUTPUT.mkdir(exist_ok=True)

def saved(page,id):
    try:page.wait_for_function("id=>document.getElementById(id).dataset.state==='saved'",arg=id,timeout=5000)
    except Exception as error:raise AssertionError(id+': '+page.locator('#'+id).inner_text()) from error
def ready(page):page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width,height in [(320,568),(390,844),(768,640),(1440,1000)]:
        options={};page=make_page(browser,ROOT,width,height,width<=768,options);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');ready(page)
        assert page.locator('#gif-url-input').count()==0
        assert page.evaluate('typeof window.sendGifByUrl')=='undefined'
        assert page.evaluate("async()=>{try{await sendLibraryGif('https://example.com/pasted.gif');return false}catch{return true}}")
        page.locator('#gif-button').click();page.wait_for_timeout(80)
        assert page.locator('.gif-library-tile').count()==31
        page.locator('#gif-search').fill('thank you');assert page.locator('[data-gif-id="thank-you"]').count()==1
        page.locator('[data-gif-id="thank-you"]').click();page.wait_for_function("!document.getElementById('gif-picker-action').disabled")
        box=page.locator('#gif-picker-action').bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,(width,box)
        page.screenshot(path=str(OUTPUT/f'gif-picker-{width}.png'))
        page.locator('#gif-picker-action').click();page.wait_for_function("document.querySelectorAll('.chat-gif').length===1")
        image=page.locator('.chat-gif img');page.wait_for_function("document.querySelector('.chat-gif img').naturalWidth>0")
        assert 'osjgQPWRx3cac' in image.get_attribute('src')
        assert page.evaluate("[...__testData.values()].filter(v=>v.type==='gif')[0].gif.provider")=='giphy'
        page.locator('.gif-motion-toggle').click();assert '200w_s.gif' in image.get_attribute('src')
        page.locator('.gif-motion-toggle').click();assert '/giphy.gif' in image.get_attribute('src')
        # Profile media is available to a normal account.
        if width<=768:page.locator('#header-menu-toggle').click()
        page.locator('#settings-btn').click();ready(page)
        assert page.locator('#profile-image-input').is_enabled()
        page.locator('#choose-avatar-gif').click();page.locator('#gif-search').fill('hello');page.locator('[data-gif-id="wave"]').click()
        page.wait_for_function("!document.getElementById('gif-picker-action').disabled");page.locator('#gif-picker-action').click()
        page.wait_for_function("document.getElementById('settings-modal').style.display==='flex'")
        assert 'xT9IgG50Fb7Mi0prBC' in page.locator('#appearance-avatar').get_attribute('src')
        assert page.locator('#update-profile-image').is_enabled();page.locator('#update-profile-image').click();saved(page,'image-save-status')
        assert page.evaluate("__testData.get('users/test-member').avatarGif.id")=='wave'
        page.locator('#choose-banner-gif').click();page.locator('#gif-search').fill('fireworks');page.locator('.gif-library-tile').click()
        page.wait_for_function("!document.getElementById('gif-picker-action').disabled");page.locator('#gif-picker-action').click()
        page.wait_for_function("document.getElementById('settings-modal').style.display==='flex'")
        page.locator('#update-profile-banner').click();saved(page,'banner-save-status')
        assert page.evaluate("__testData.get('users/test-member').bannerGif.id")=='fireworks'
        page.reload(wait_until='load');ready(page)
        page.locator('#user-profile-trigger').evaluate('(el)=>el.click()')
        page.wait_for_function("document.getElementById('profile-modal').style.display==='flex'")
        assert '26tOZ42Mg6pbTUPHW' in page.locator('#profile-banner-image').get_attribute('src')
        assert 'xT9IgG50Fb7Mi0prBC' in page.locator('#profile-modal-image').get_attribute('src')
        assert not errors,(width,errors)
        page.close()
    # Failed GIF loads show a retry, rather than the default user avatar.
    options={'fail_original':True};page=make_page(browser,ROOT,390,844,True,options)
    page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');ready(page)
    page.locator('#gif-button').click();page.locator('[data-gif-id="wave"]').click();page.wait_for_function("!document.getElementById('gif-picker-action').disabled");page.locator('#gif-picker-action').click()
    page.wait_for_function("document.querySelector('.gif-load-error') && !document.querySelector('.gif-load-error').hidden")
    assert 'avatar.svg' not in page.locator('.chat-gif img').get_attribute('src')
    options['fail_original']=False;page.locator('.gif-load-error button').click();page.wait_for_function("document.querySelector('.chat-gif img').naturalWidth>0 && document.querySelector('.gif-load-error').hidden")
    page.locator('#header-menu-toggle').click();page.locator('#settings-btn').click();ready(page)
    # Original GIF bytes survive the upload and account save without a canvas conversion.
    page.locator('#profile-image-input').set_input_files({'name':'animated.gif','mimeType':'image/gif','buffer':GIF})
    page.wait_for_function("!document.getElementById('update-profile-image').disabled");page.locator('#update-profile-image').click();saved(page,'image-save-status')
    assert page.evaluate("__testData.get('users/test-member').photoURL")==('data:image/gif;base64,'+base64.b64encode(GIF).decode())
    page.locator('#profile-banner-input').set_input_files({'name':'banner.gif','mimeType':'image/gif','buffer':GIF})
    page.wait_for_function("!document.getElementById('update-profile-banner').disabled");page.locator('#update-profile-banner').click();saved(page,'banner-save-status')
    assert page.evaluate("__testData.get('users/test-member').bannerURL")==('data:image/gif;base64,'+base64.b64encode(GIF).decode())
    page.locator('#reset-banner').click();page.locator('#update-profile-banner').click();saved(page,'banner-save-status')
    assert page.evaluate("__testData.get('users/test-member').bannerURL")==''
    assert page.locator('#appearance-banner').is_hidden()
    assert page.evaluate("LyriaMedia.safeUrl('')")==''
    page.locator('#profile-banner-input').set_input_files({'name':'too-big.gif','mimeType':'image/gif','buffer':GIF+b'0'*350000})
    page.wait_for_function("document.getElementById('banner-save-status').dataset.state==='error'")
    assert '350 KB' in page.locator('#banner-save-status').inner_text()
    page.close()
    # The library remains usable when the phone keyboard reduces the visible area.
    page=make_page(browser,ROOT);page.goto('http://localhost:8124/home.html?channel=community',wait_until='load');ready(page)
    page.locator('#gif-button').click();page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,value:360});visualViewport.dispatchEvent(new Event('resize'))")
    page.wait_for_timeout(100);page.locator('#gif-search').fill('thanks');page.locator('.gif-library-tile').first.click();page.wait_for_function("!document.getElementById('gif-picker-action').disabled");page.locator('#gif-picker-action').click()
    page.wait_for_function("document.querySelectorAll('.chat-gif').length===1")
    page.close();browser.close()
print('PASS: library-only selection, search, chat GIF rendering/motion/retry, avatar and banner GIF persistence, original animated uploads, upload limits, and phone keyboard layout.')
