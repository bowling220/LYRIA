"""Read/write reduction and compact avatars; local fixtures, no production requests."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
 page=make_page(b,ROOT,1440,1000)
 page.add_init_script("""window.__budgetCounts=[];let api;Object.defineProperty(window,'LyriaDataAPI',{configurable:true,get:()=>api,set:value=>{api=value;value.count=async(collection,options)=>{__budgetCounts.push(options.parent);return 0}}});for(let i=0;i<50;i++)__testData.set('channels/budget-'+i,{name:'Budget '+i,members:['test-member'],createdBy:'test-member'});""")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready' && __budgetCounts.length>=20")
 assert page.evaluate('__budgetCounts.length')==20,'Quiet-room refresh should need at most 20 count queries'
 page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(100)
 assert page.evaluate('__budgetCounts.length')==20,'Visibility events should not evade refresh pacing'
 page.evaluate("""()=>{window.__typingWrites=0;const ref=firebase.firestore().collection('channels'),proto=Object.getPrototypeOf(ref),set=proto.set;proto.set=function(...args){if(this.path.includes('/typingStatus/'))__typingWrites++;return set.apply(this,args)}}""")
 page.locator('#message-input').press_sequentially('Typing should not write on every key',delay=5);page.locator('#channel-title').click()
 assert page.evaluate('__typingWrites')<=2,'Typing start/stop should coalesce keystrokes'
 avatar='data:image/gif;base64,'+(ROOT/'tests/fixtures/animated.gif.base64').read_text().strip()
 page.evaluate("value=>{__testData.get('users/test-member').photoURL=value;__testData.get('profiles/test-member').photoURL=value;document.getElementById('user-avatar').src=value}",avatar)
 page.locator('#message-input').fill('Compact avatar payload');page.locator('#send-button').click()
 page.wait_for_function("[...__testData.values()].some(v=>v.message==='Compact avatar payload')")
 assert page.evaluate("[...__testData.values()].find(v=>v.message==='Compact avatar payload').senderPhotoURL")=='assets/avatar.svg'
 page.wait_for_function("document.querySelectorAll('.message').length===4 && document.querySelector('.message:last-child .sender-avatar').src.startsWith('data:image/gif')")
 page.close()
 # The enabled rollout uses real client paths; emulator tests cover atomic rules.
 page=make_page(b,ROOT,1440,1000)
 page.add_init_script("""(()=>{__testData.set('systemConfig/freeLimits',{enabled:true});const db=firebase.firestore(),Ref=db.collection('channels').constructor;db.doc=path=>new Ref(path,true);firebase.firestore.FieldValue.serverTimestamp=()=>new Date();db.runTransaction=async callback=>{const writes=[];const result=await callback({get:ref=>ref.get(),set:(ref,value,options)=>writes.push(()=>ref.set(value,options)),update:(ref,value)=>writes.push(()=>ref.update(value)),delete:ref=>writes.push(()=>ref.delete())});for(const write of writes)await write();return result}})();""")
 page.goto('http://localhost:8124/home.html?channel=community');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready' && !LyriaLoading.isBlocking()")
 for i in range(10):
  page.locator('#message-input').fill('Budget message '+str(i));page.locator('#send-button').click();page.wait_for_function("document.getElementById('message-input').value===''")
 page.locator('#message-input').fill('Keep this draft');page.locator('#send-button').click();page.wait_for_function("!document.getElementById('send-button').disabled")
 assert page.locator('#message-input').input_value()=='Keep this draft'
 assert page.evaluate("__testData.get('usageLimits/test-member/actions/messages').shortCount")==10
 assert not page.evaluate("[...__testData.values()].some(v=>v.message==='Keep this draft')")
 page.close()
 page=make_page(b,ROOT);page.add_init_script("__testData.set('systemConfig/freeLimits',{enabled:true});__firebaseModule.serverTimestamp=()=>new Date();")
 page.goto('http://localhost:8124/News.html');page.locator('#create-article-button').click();page.wait_for_selector('#article-form',state='visible')
 page.locator('#article-title').fill('Enabled budget article');page.locator('#article-body').fill('A community article with enforced budgets.');page.locator('#article-form button[type=submit]').click();page.wait_for_selector('#reader-title')
 page.locator('.journal-like').click();page.wait_for_function("document.querySelector('.journal-like').getAttribute('aria-pressed')==='true'")
 assert page.evaluate("__testData.get('usageLimits/test-member/actions/articles').shortCount")==1
 assert page.evaluate("__testData.get('usageLimits/test-member/actions/reactions').shortCount")==1
 page.close();b.close()
print('PASS: 50-room quiet refresh uses 20 counts, visibility pacing, coalesced typing, compact message payloads and preserved animated profile avatars.')
