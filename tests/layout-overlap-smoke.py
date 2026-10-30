"""Hit-testing and geometry for fixed controls, transient UI and short windows."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
from browser_executable import CHROMIUM
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width,height in [(320,480),(390,844),(568,320),(667,375),(768,600),(900,600),(1024,480),(1024,600),(1440,900)]:
  page=make_page(browser,root,width,height,width<=768)
  page.add_init_script("__testData.get('channels/studio').name='A'.repeat(80);__testData.get('channels/studio').description='A'.repeat(300)")
  page.goto('http://localhost:8124/home.html?channel=studio');page.wait_for_selector('[data-channel-id=studio]');page.wait_for_timeout(100)
  assert page.locator('#channel-title').evaluate('el=>el.getBoundingClientRect().right<=el.closest(".chat-title-group").getBoundingClientRect().right+1'),(width,height,'title overlaps actions')
  page.locator('#rail-chats').click();page.locator('[data-channel-id=community]').click();page.wait_for_selector('.message')
  page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  for id in ['settings-btn','send-button','conversation-details-toggle']:
   control=page.locator('#'+id);box=control.bounding_box()
   assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(width,height,id,box)
   assert control.evaluate('el=>el.contains(document.elementFromPoint(el.getBoundingClientRect().x+el.clientWidth/2,el.getBoundingClientRect().y+el.clientHeight/2))'),(width,height,id,'covered')
  page.locator('#message-input').fill('One line\nA second line\nA third line\n@Maya')
  page.wait_for_selector('#mention-suggestions:not([hidden])');page.wait_for_timeout(100)
  composer=page.locator('.message-composer').bounding_box();menu=page.locator('#mention-suggestions').bounding_box();header=page.locator('.chat-header').bounding_box()
  assert menu['y']+menu['height']<=composer['y']-1,(width,height,'mentions overlap composer',menu,composer)
  assert menu['y']>=header['y']+header['height']-1,(width,height,'mentions overlap header',menu,header)
  page.keyboard.press('Escape')
  page.evaluate("LyriaUI.notify('This is a notification above the composer.','success')")
  page.wait_for_selector('#toast-region .toast')
  toast=page.locator('#toast-region').bounding_box();composer=page.locator('.message-composer').bounding_box()
  assert toast['y']+toast['height']<=composer['y']-1,(width,height,'toast overlaps composer',toast,composer)
  assert page.locator('#send-button').evaluate('el=>el.contains(document.elementFromPoint(el.getBoundingClientRect().x+el.clientWidth/2,el.getBoundingClientRect().y+el.clientHeight/2))')
  if width==390:
   page.locator('#toast-region button').click();page.locator('#message-input').fill('')
   page.evaluate("document.body.style.setProperty('--shell-safe-top','44px');document.body.style.setProperty('--shell-safe-bottom','34px')")
   page.wait_for_timeout(100)
   assert page.locator('.chat-panel').bounding_box()['y']>=98
   rail=page.locator('.app-rail').bounding_box();composer=page.locator('.message-composer').bounding_box()
   assert composer['y']+composer['height']<=rail['y']
   page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,value:360});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:50});visualViewport.dispatchEvent(new Event('resize'))")
   page.wait_for_timeout(100)
   assert page.locator('.app-rail').is_hidden()
   assert abs(page.locator('.top-header').bounding_box()['y']-50)<2,'viewport offset applied twice'
   composer=page.locator('.message-composer').bounding_box()
   assert composer['y']+composer['height']<=410
   page.locator('#header-menu-toggle').click();drawer=page.locator('.conversation-panel').bounding_box()
   assert drawer['y']>=148 and drawer['y']+drawer['height']<=410
  page.close()
 browser.close()
print('PASS: nine window sizes; fixed control hit targets, long titles, multiline mentions, header separation and unobstructed composer notifications.')
