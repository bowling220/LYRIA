"""Pinned account dock, scrolling groups, and confirmed account-backed feedback."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(320,568),(390,844),(667,375),(768,1024),(1440,900)]:
  page=make_page(browser,ROOT,width,height);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("for(let i=0;i<50;i++)__testData.set('channels/group-'+i,{name:'Group '+i,members:['test-member']});")
  page.goto('http://localhost:8124/home.html?view=hub');page.wait_for_selector('[data-channel-id=group-49]',state='attached')
  if width<=768:page.locator('#header-menu-toggle').click()
  dock=page.locator('.user-profile');before=dock.bounding_box()
  assert before['y']>=0 and before['y']+before['height']<=height+1,(width,height,before)
  page.locator('.sidebar-scroll').evaluate('(el)=>el.scrollTop=el.scrollHeight');page.wait_for_timeout(100)
  after=dock.bounding_box();assert abs(after['y']-before['y'])<1
  assert page.locator('.sidebar-scroll').evaluate('(el)=>el.scrollTop>0')
  assert page.locator('#settings-btn').is_visible()
  page.screenshot(path='/tmp/sidebar-'+str(width)+'.png')
  page.locator('#open-suggestions-modal').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='ready'")
  page.locator('#feedback-kind').select_option('bug');page.locator('#feedback-title').fill('A helpful report');page.locator('#feedback-details').fill('The sidebar should keep my profile visible.')
  page.evaluate('window.__failCommit=true');page.locator('#feedback-submit').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='error'")
  assert page.locator('#feedback-details').input_value().startswith('The sidebar')
  page.keyboard.press('Escape')
  if width<=768:page.locator('#header-menu-toggle').click()
  page.locator('#open-suggestions-modal').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='ready'")
  assert page.locator('#feedback-title').input_value()=='A helpful report'
  page.evaluate('window.__failCommit=false;window.__loseFeedbackAck=true');page.locator('#feedback-submit').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='error'")
  assert page.evaluate("__testData.get('users/test-member').feedbackSubmissions.length")==1
  page.locator('#feedback-submit').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='saved'")
  assert page.evaluate("__testData.get('users/test-member').feedbackSubmissions.length")==1
  assert page.evaluate("__testData.get('users/test-member').friends[0]")=='maya'
  assert page.locator('.feedback-record').count()==1
  page.screenshot(path='/tmp/feedback-'+str(width)+'.png')
  page.keyboard.press('Escape')
  page.reload();page.wait_for_selector('.hub-conversation')
  if width<=768:page.locator('#header-menu-toggle').click()
  page.locator('#open-suggestions-modal').click();page.wait_for_function("document.getElementById('feedback-status').dataset.state==='ready'")
  assert page.locator('.feedback-record').count()==1
  assert not errors,errors
  page.close()
 browser.close()
print('PASS: fixed profile, independently scrolling groups, five layouts, feedback failure/retry/drafts, confirmed storage and retained account data.')
