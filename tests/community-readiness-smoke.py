"""Safety, drafts, send certainty, compact navigation and safe diagnostics; fixtures only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'test-artifacts'/'readiness';ART.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [375,390,430,1440]:
  page=make_page(browser,ROOT,width,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("__testData.get('channels/studio').name='Café créatif';")
  page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.querySelectorAll('.message').length===3 && document.getElementById('account-load-status').dataset.state==='ready' && !LyriaLoading.isBlocking()")
  page.locator('#message-input').fill('A private draft for this room');page.reload();page.wait_for_function("document.getElementById('message-input').value==='A private draft for this room'")
  page.locator('[data-sender-id="maya"] .sender-profile').first.click();page.get_by_role('button',name='Block member',exact=True).click();page.wait_for_function("LyriaSafety.isBlocked('maya')")
  assert page.locator('.message[data-sender-id="maya"]:visible').count()==0
  page.get_by_role('button',name='Unblock member',exact=True).click();page.wait_for_function("!LyriaSafety.isBlocked('maya')")
  page.get_by_role('button',name='Report member',exact=True).click();page.locator('#report-details').fill('Please review this profile.');page.locator('#report-submit').click();page.wait_for_function("document.getElementById('report-status').textContent.includes('submitted')")
  assert page.evaluate("[...__testData].filter(([p,d])=>p.startsWith('abuseReports/') && d.reporterId==='test-member').length")==1
  page.locator('#close-report').click();page.locator('#close-profile-modal').click()
  page.locator('#rail-settings').click();page.locator('#voice-copy-diagnostics').click();diagnostics=page.locator('#voice-safe-diagnostics').inner_text();assert 'Relay configured: No' in diagnostics and 'fixture-token' not in diagnostics
  page.locator('#close-settings-modal').click() if page.locator('#close-settings-modal').count() else page.keyboard.press('Escape')
  page.locator('#header-menu-toggle').evaluate('b=>b.click()') if width<769 else None
  page.locator('#conversation-search').fill('cafe');page.wait_for_timeout(80)
  assert page.locator('#channels-list li:visible').count()==1
  page.locator('#conversation-search').fill('does not exist');assert 'No matches' in page.locator('#conversation-filter-empty').inner_text()
  page.locator('#conversation-search').fill('');assert page.locator('#channels-list .channel-btn').first.bounding_box()['height']<=56
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  while page.get_by_role('button',name='Dismiss notification',exact=True).count():page.get_by_role('button',name='Dismiss notification',exact=True).first.click()
  page.screenshot(path=str(ART/f'community-{width}.png'),full_page=True)
  assert not errors,errors
  page.close()
 # Moderator queue uses the same real API adapter and cannot invent report counts.
 page=make_page(browser,ROOT,1440,1000)
 page.add_init_script("__testData.get('users/test-member').role='moderator';__testData.set('abuseReports/review',{reporterId:'maya',targetUserId:'test-member',status:'open',reason:'spam',details:'Fixture-only concern'});")
 page.goto('http://localhost:8124/home.html?view=hub');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'");page.locator('#rail-settings').click();page.locator('#open-moderation').click();page.wait_for_selector('.moderation-report');page.get_by_role('button',name='Resolve',exact=True).click();page.wait_for_function("__testData.get('abuseReports/review').status==='resolved'");assert page.evaluate("__testData.get('abuseReports/review').reviewedBy")=='test-member';page.close()
 # GIF retries reuse their operation too; failed acknowledgements do not double-post.
 page=make_page(browser,ROOT,1440,1000);page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.querySelectorAll('.message').length===3 && !LyriaLoading.isBlocking()")
 page.evaluate("""()=>{const f=fetch;let once=true;window.fetch=async(url,options)=>{const r=await f(url,options);if(once && String(url).endsWith(':commit') && JSON.parse(options.body).writes.some(w=>w.update?.fields?.type?.stringValue==='gif')){once=false;return new Response(JSON.stringify({error:{message:'Lost GIF acknowledgement'}}),{status:503})}return r}}""")
 page.evaluate("async()=>{const id=LyriaGifLibrary.search('','All')[0].id;try{await sendLibraryGif(id)}catch{};await sendLibraryGif(id)}")
 assert page.evaluate("[...__testData.values()].filter(d=>d.type==='gif').length")==1;page.close()
 # The backend is fixture-persisted across reload to model a lost acknowledgement.
 page=make_page(browser,ROOT,1440,1000)
 page.add_init_script("""const old=sessionStorage.getItem('readiness-ack');if(old){const [path,data]=JSON.parse(old);data.timestamp={toDate:()=>new Date('2026-10-29T10:30:00Z')};__testData.set(path,data)}""")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.querySelectorAll('.message').length===3 && !LyriaLoading.isBlocking()")
 page.evaluate("""()=>{const f=fetch;window.fetch=async(url,options)=>{const r=await f(url,options);if(String(url).endsWith(':commit') && JSON.parse(options.body).writes.some(w=>w.update?.name.includes('/messages/'))){const entry=[...__testData].find(([p,d])=>d.message==='One durable operation');sessionStorage.setItem('readiness-ack',JSON.stringify(entry));return new Response(JSON.stringify({error:{message:'Lost acknowledgement'}}),{status:503})}return r}}""")
 page.locator('#message-input').fill('One durable operation');page.locator('#send-button').click();page.wait_for_function("document.getElementById('message-send-status').textContent.includes('Not confirmed')")
 page.reload();page.wait_for_function("document.getElementById('message-input').value==='One durable operation' && !LyriaLoading.isBlocking()");page.locator('#send-button').click();page.wait_for_function("document.getElementById('message-input').value===''");assert page.evaluate("[...__testData.values()].filter(d=>d.message==='One durable operation').length")==1
 assert page.locator('#message-send-status').inner_text()=='Sent.';page.close();browser.close()
print('PASS: four compact layouts, private reload drafts, block/unblock/report, moderator review, safe voice diagnostics, accent search, empty states, and lost-ack retry across reload without duplicates.')
