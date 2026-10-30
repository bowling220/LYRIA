from pathlib import Path
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox']);page=make_page(b,ROOT,390,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:8124/home.html');page.wait_for_selector('[data-channel-id=personal-test-member]')
 page.locator('#header-menu-toggle').click();page.locator('[data-channel-id=personal-test-member]').click()
 page.evaluate("Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.__copied=value},configurable:true})")
 page.locator('#copy-join-code').click();page.wait_for_selector('#invite-owner-controls:not([hidden])')
 page.locator('#invite-expiry').select_option('1');page.locator('#replace-invite').click()
 page.wait_for_function("document.getElementById('invite-control-status').textContent.includes('New link ready')")
 link=page.locator('#share-invite-link').input_value();code=link.split('code=')[1];assert len(code)==32
 assert page.evaluate("__testData.get('channelInvites/ALEX01').revoked")
 assert page.evaluate("__testData.get('channelInvites/'+__testData.get('channels/personal-test-member').activeInvite).expiresAt.getTime()>Date.now()")
 page.locator('#copy-invite-link').click();page.wait_for_function("window.__copied===document.getElementById('share-invite-link').value")
 page.locator('#revoke-invite').click();page.wait_for_function("document.getElementById('invite-control-status').textContent.includes('Invitation revoked')")
 assert page.evaluate("__testData.get('channelInvites/'+"+repr(code)+").revoked")
 assert page.evaluate("__testData.get('channels/personal-test-member').members.includes('test-member')")
 assert not errors,errors;page.close();b.close()
print('PASS: owner expiration, random-token replacement, atomic old-link revocation, copy, revoke, and retained membership.')
