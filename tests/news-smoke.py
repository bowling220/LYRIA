"""Editorial News, legacy engagement, publishing, security, pagination and responsive reading."""
from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'test-artifacts'/'journal';ART.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 for width in [375,390,430,1280,1440,1920]:
  page=make_page(browser,ROOT,width,950 if width>700 else 844);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("__testData.set('userArticles/real-demo',{title:'A community story for the journal',body:'A real conversation starts with listening.\\n\\n## A little room for ideas\\n\\n- Share something useful\\n- Make people welcome',authorName:'Maya Chen',timestamp:'2026-10-29T10:00:00Z',category:'community',imageURL:'https://missing.example.test/image.png',tags:['community']});")
  page.goto('http://localhost:8124/News.html');page.wait_for_selector('.journal-feature h2');page.wait_for_function("document.getElementById('journal-load-status').hidden")
  assert page.locator('.journal-feature h2').inner_text()=='A community story for the journal'
  assert page.locator('.journal-card').count()==6
  assert page.locator('.journal-discussion').count()==0
  assert page.locator('.journal-feature .journal-cover img').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  page.screenshot(path=str(ART/f'homepage-{width}.png'),full_page=True)
  page.locator('.journal-feature a').click();page.wait_for_selector('#reader-title')
  assert 'story=member-real-demo' in page.url
  assert page.locator('.journal-prose h2').inner_text()=='A little room for ideas'
  assert page.locator('.journal-prose li').count()==2
  assert page.locator('.journal-prose').bounding_box()['width']<=721
  page.evaluate('window.__failNewsReaction=true');page.locator('.journal-like').click();page.wait_for_function("!document.querySelector('.journal-like').disabled")
  assert not page.evaluate("__testData.has('posts/user-real-demo')")
  page.evaluate('window.__failNewsReaction=false');page.locator('.journal-like').click();page.wait_for_function("document.querySelector('.journal-like').getAttribute('aria-pressed')==='true'")
  page.locator('.journal-like').click();page.wait_for_function("document.querySelector('.journal-like').getAttribute('aria-pressed')==='false'")
  page.locator('.journal-comment-form textarea').fill('<img src=x onerror=alert(1)> A thoughtful response')
  page.locator('.journal-comment-form button').click();page.wait_for_selector('.journal-comment')
  assert page.locator('.journal-comment img').count()==0
  assert '<img src=x' in page.locator('.journal-comment').inner_text()
  assert page.evaluate("[...__testData.keys()].some(k=>k.startsWith('articles/user-real-demo/comments/'))")
  page.evaluate('window.scrollTo(0,0)')
  page.screenshot(path=str(ART/f'article-{width}.png'),full_page=True)
  page.reload();page.wait_for_selector('#reader-title');assert page.locator('#reader-title').inner_text()=='A community story for the journal'
  page.locator('.journal-back').click();page.wait_for_selector('#journal-title',state='visible')
  page.locator('[data-category=announcements]').click();assert page.locator('.journal-feature .journal-category').text_content()=='Announcements'
  page.go_back();page.wait_for_selector('.journal-feature')
  page.goto('http://localhost:8124/News.html?story=archive-voice-call-feature');page.wait_for_selector('#reader-title');page.locator('#comment-input-voice-call').fill('Legacy thread retained');page.locator('.journal-comment-form button').click();page.wait_for_selector('.journal-comment')
  assert page.evaluate("[...__testData.keys()].some(k=>k.startsWith('articles/voice-call/comments/'))")
  page.locator('.journal-like').click();page.wait_for_function("__testData.get('posts/voice-call-feature')?.likes===1")
  assert not errors,(width,errors)
  page.close()
 # Authenticated publishing, ownership metadata, retained draft on error and XSS-safe content.
 page=make_page(browser,ROOT,1440,1000);page.goto('http://localhost:8124/News.html');page.locator('#create-article-button').click();page.wait_for_selector('#article-form',state='visible')
 page.locator('#article-title').fill('<img src=x onerror=alert(1)> A member story');page.locator('#article-body').fill('## A heading\n\nA paragraph <script>alert(1)</script>\n\n> A useful quotation\n\n```\nconst hello = "LYRIA";\n```');page.locator('#article-category').select_option('guides')
 page.evaluate('window.__failNewsWrite=true');page.locator('#article-form button[type=submit]').click();page.wait_for_function("document.getElementById('article-publish-status').textContent.includes('wasn’t published')")
 assert page.locator('#article-body').input_value().startswith('## A heading')
 page.evaluate('window.__failNewsWrite=false');page.locator('#article-form button[type=submit]').click();page.wait_for_selector('#reader-title')
 assert page.locator('#reader-title img').count()==0 and '<img' in page.locator('#reader-title').inner_text()
 assert page.locator('.journal-prose script').count()==0 and page.locator('.journal-prose pre').count()==1
 assert page.evaluate("[...__testData].some(([k,v])=>k.startsWith('userArticles/') && v.authorId==='test-member' && v.category==='guides')")
 page.close()
 # Guests can publish; author blocks remain enforced and a sign-out cannot reuse old auth state.
 page=make_page(browser,ROOT);page.add_init_script("firebase.auth().currentUser.isAnonymous=true;firebase.auth().currentUser.displayName=null;")
 page.goto('http://localhost:8124/News.html');page.locator('#create-article-button').click();page.wait_for_selector('#article-form',state='visible');assert page.locator('#article-author').input_value()=='Guest'
 page.locator('#article-title').fill('A guest contribution');page.locator('#article-body').fill('A community story.');page.locator('#article-form button[type=submit]').click();page.wait_for_selector('#reader-title');assert page.locator('#reader-title').inner_text()=='A guest contribution'
 page.evaluate("firebase.auth().currentUser=null");page.locator('.journal-like').click();page.wait_for_timeout(80);assert not page.evaluate("[...__testData.keys()].some(k=>k.startsWith('userLikes/'))");page.close()
 page=make_page(browser,ROOT);page.add_init_script("firebase.auth().currentUser.uid='dOVyjlLfVXPA9cWO2VCxR5zfgKW2'");page.goto('http://localhost:8124/News.html');page.wait_for_function("document.getElementById('create-article-button').hidden");page.evaluate('toggleUserArticles()');assert page.locator('#user-article-section').is_hidden();page.close()
 # Supplied images and author avatars load; failed optional imagery does not break the article.
 page=make_page(browser,ROOT);page.add_init_script("__testData.set('userArticles/illustrated',{title:'An illustrated story',body:'A complete story.',authorName:'Maya Chen',authorPhotoURL:'https://images.example.test/avatar.svg',imageURL:'https://images.example.test/cover.png',timestamp:'2026-10-29T10:00:00Z'});")
 page.route('https://images.example.test/avatar.svg',lambda r:r.fulfill(body=(ROOT/'assets/avatar.svg').read_bytes(),content_type='image/svg+xml'))
 page.route('https://images.example.test/cover.png',lambda r:r.fulfill(body=(ROOT/'assets/status-feature.png').read_bytes(),content_type='image/png'))
 page.goto('http://localhost:8124/News.html');page.wait_for_selector('.journal-feature .journal-cover.has-image');assert page.locator('.journal-feature .journal-author-avatar img').count()==1;page.close()
 # Signed-out reading remains public; writing and interactions require authentication.
 page=make_page(browser,ROOT);page.add_init_script("firebase.auth().currentUser=null;firebase.auth().onAuthStateChanged=fn=>{queueMicrotask(()=>fn(null));return()=>{}}")
 page.goto('http://localhost:8124/News.html?story=archive-status-feature');page.wait_for_selector('#reader-title');page.locator('.journal-like').click();page.wait_for_timeout(80)
 assert not page.evaluate("__testData.has('posts/status-feature')")
 page.locator('#create-article-button').click();assert page.locator('#user-article-section').is_hidden();page.close()
 # Unknown IDs, unavailable live feed, comments failure, and long content.
 page=make_page(browser,ROOT);page.add_init_script('window.__failNewsFeed=true');page.goto('http://localhost:8124/News.html');page.wait_for_selector('#journal-load-status button');assert page.locator('.journal-card').count()>0
 page.evaluate('window.__failNewsFeed=false');page.locator('#journal-load-status button').click();page.wait_for_function("document.getElementById('journal-load-status').hidden")
 page.goto('http://localhost:8124/News.html?story=missing');page.wait_for_selector('.journal-empty h2');assert 'isn’t available' in page.locator('.journal-empty h2').inner_text();page.close()
 page=make_page(browser,ROOT,375,844);page.add_init_script("window.__failNewsComments=true;__testData.set('userArticles/long',{title:'LongHeadline'.repeat(40),body:('A thoughtful paragraph. '.repeat(50)+'\\n\\n').repeat(25),authorName:'A long author name '.repeat(20),timestamp:'2026-10-29T10:00:00Z'});")
 page.goto('http://localhost:8124/News.html?story=member-long');page.wait_for_selector('#reader-title');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert page.locator('.journal-prose p').count()==25
 assert 'couldn’t load' in page.locator('.journal-comments').inner_text();page.close()
 # Pagination is explicit and bounded; older member stories remain reachable.
 page=make_page(browser,ROOT,1440,1000);page.add_init_script("for(let i=0;i<31;i++)__testData.set('userArticles/story-'+i,{title:'Member story '+i,body:'A community contribution.',authorName:'A member',timestamp:new Date(Date.UTC(2026,9,29,10,i)).toISOString()});")
 page.goto('http://localhost:8124/News.html');page.wait_for_function("document.getElementById('journal-load-status').hidden")
 for _ in range(8):
  if page.locator('#journal-more').is_visible():page.locator('#journal-more').click();page.wait_for_timeout(40)
 assert page.locator('.user-submitted').count()==31
 assert page.locator('.journal-story-link').count()==44
 page.close();browser.close()
print('PASS: six sizes, editorial home/reader, real member loading, legacy IDs, likes/comments, safe publishing/errors, signed-out guards, fallbacks, long stories, failures, reload/history and bounded pagination.')
