"""Real composer controls; bundled emojis and bounded, paginated provider fixtures."""
from pathlib import Path
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-artifacts';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width,height in [(320,568),(390,844),(667,375),(1440,1000)]:
  page=make_page(browser,ROOT,width,height,width<=768);errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto('http://localhost:8124/home.html?channel=community')
  page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
  assert page.locator('#composer-image').count()==0
  assert page.locator('.message-composer #gif-button').count()==1
  assert page.locator('#gif-button [data-icon=image]').count()==0
  assert page.locator('#composer-emoji').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  field=page.locator('#message-input')
  assert field.evaluate('el=>{const s=getComputedStyle(el);return el.scrollHeight<=Math.ceil(parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(s.lineHeight))+1}'),(width,'empty placeholder wraps and clips')
  field.fill('hello friend');field.focus()
  field.evaluate('el=>{el.setSelectionRange(6,12);el.dispatchEvent(new Event("select"))}')
  page.locator('#composer-emoji').click();page.wait_for_selector('#emoji-results button')
  assert '3,781' in page.locator('#emoji-status').inner_text()
  assert page.locator('#emoji-results button').count()==120
  page.locator('#emoji-search').fill('herb')
  page.get_by_role('button',name='Insert herb',exact=True).click()
  assert field.input_value()=='hello 🌿'
  page.wait_for_function("document.getElementById('message-input')===document.activeElement")
  assert page.evaluate("JSON.parse(localStorage.getItem('lyria:recent-emojis'))[0]")=='🌿'
  page.locator('#composer-emoji').click();page.locator('[data-category=Recent]').click()
  assert page.locator('#emoji-results button').count()==1
  page.locator('[data-category=Flags]').click();assert page.locator('#emoji-results button').count()==120
  page.locator('#emoji-more').click();assert page.locator('#emoji-results button').count()==240
  first=page.locator('#emoji-results button').first;first.focus();page.keyboard.press('ArrowRight')
  assert page.locator('#emoji-results button').nth(1).evaluate('el=>el===document.activeElement')
  page.locator('#emoji-search').fill('no-matching-emoji-zzzz')
  assert page.locator('#emoji-results button').count()==0
  assert 'No emojis found' in page.locator('#emoji-status').inner_text()
  page.locator('#emoji-search').fill('cat')
  page.screenshot(path=str(OUT/f'emoji-picker-{width}.png'))
  box=page.locator('.emoji-picker').bounding_box()
  assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(width,box)
  page.keyboard.press('Escape');assert page.locator('#emoji-modal').is_hidden()
  field.fill('Emoji message 😊');page.locator('#send-button').click()
  page.wait_for_function("[...__testData.values()].some(v=>v.message==='Emoji message 😊')")
  page.screenshot(path=str(OUT/f'composer-{width}.png'))
  assert not errors,(width,errors)
  page.close()
 # Provider responses are deterministic and isolated: no keys or external writes.
 page=make_page(browser,ROOT,390,844);page.add_init_script("window.LYRIA_GIPHY_API_KEY='public-test-key'")
 requests=[];state={'fail50':False,'failed':False}
 def giphy(route):
  query=parse_qs(urlparse(route.request.url).query);offset=int(query['offset'][0]);limit=int(query['limit'][0]);requests.append((offset,limit,query.get('q')))
  if state['fail50'] and offset==50 and not state['failed']:
   state['failed']=True;route.fulfill(status=503,json={});return
  result=[{'id':'Test'+str(i),'title':'Test GIF '+str(i),'images':{'fixed_width':{'width':'200','height':'150'}}} for i in range(offset,min(offset+limit,230))]
  route.fulfill(json={'data':result,'pagination':{'total_count':230}})
 page.route('https://api.giphy.com/**',giphy)
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_selector('#send-button')
 page.locator('#gif-button').click();page.wait_for_function("document.querySelectorAll('.gif-library-tile').length===100 && !document.querySelector('.gif-load-more').disabled")
 assert [(o,l) for o,l,_ in requests]==[(0,50),(50,50)]
 page.locator('.gif-load-more').click();page.wait_for_function("document.querySelectorAll('.gif-library-tile').length===200 && !document.querySelector('.gif-load-more').disabled")
 page.locator('.gif-load-more').click();page.wait_for_function("document.querySelectorAll('.gif-library-tile').length===230")
 assert page.locator('.gif-load-more').is_hidden()
 page.locator('#gif-search').fill('cats');page.wait_for_function("document.querySelectorAll('.gif-library-tile').length===100 && !document.querySelector('.gif-load-more').disabled")
 assert requests[-1][2]==['cats']
 page.keyboard.press('Escape');state['fail50']=True
 page.locator('#gif-button').click();page.wait_for_selector('.gif-load-more:text("Retry loading GIFs")')
 assert page.locator('.gif-library-tile').count()==50,'A failed second page must retain the first page'
 page.locator('.gif-load-more').click();page.wait_for_function("document.querySelectorAll('.gif-library-tile').length>=100 && !document.querySelector('.gif-load-more').disabled")
 assert not page.locator('#gif-picker-feedback').inner_text()
 page.close()
 # A missing bundled data response is recoverable and never discards the draft.
 page=make_page(browser,ROOT,390,844);attempts=[0]
 def emoji_data(route):
  attempts[0]+=1
  if attempts[0]==1:route.fulfill(status=503,body='')
  else:route.fulfill(body=(ROOT/'assets/emoji/emoji-16.0.json').read_bytes(),content_type='application/json')
 page.route('**/assets/emoji/emoji-16.0.json',emoji_data)
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_selector('#send-button')
 page.locator('#message-input').fill('Keep this draft');page.locator('#composer-emoji').click()
 page.locator('#emoji-retry').click();page.wait_for_selector('#emoji-results button')
 assert page.locator('#message-input').input_value()=='Keep this draft'
 page.keyboard.press('Escape');page.locator('#message-input').fill('x'*4000)
 page.locator('#composer-emoji').click();page.locator('#emoji-results button').first.click()
 assert 'Your message is full' in page.locator('#emoji-status').inner_text()
 assert len(page.locator('#message-input').input_value())==4000
 page.close();browser.close()
print('PASS: single GIF control; 3,781 searchable/category/recent emojis; selected-range insertion, keyboard, draft/length/retry safety; four layouts; 100 initial GIFs, pagination beyond 200 and partial-page recovery.')
