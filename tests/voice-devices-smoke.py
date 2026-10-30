from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_fixture import make_page
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
 page=make_page(browser,ROOT,390,900);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__captures=0;navigator.mediaDevices.getUserMedia=async c=>{__captures++;return capture(c)}")
 page.goto('http://localhost:8124/home.html');page.wait_for_function("document.getElementById('account-load-status').dataset.state==='ready'")
 page.locator('#settings-btn').evaluate('(el)=>el.click()');page.wait_for_selector('#voice-test-input')
 assert page.evaluate('__captures')==0
 page.locator('#voice-test-connection').click();page.wait_for_function("document.getElementById('voice-device-status').textContent.includes('No voice relay')")
 assert page.evaluate('__captures')==0
 page.locator('#voice-test-input').click();page.wait_for_function("document.getElementById('voice-device-status').textContent.includes('Microphone opened')")
 assert page.evaluate('LyriaVoice.getSession()') is None
 page.locator('#voice-stop-test').click();assert 'stopped' in page.locator('#voice-device-status').inner_text()
 page.wait_for_function("document.getElementById('voice-input-device').options.length>1")
 device=page.locator('#voice-input-device option').nth(1).get_attribute('value');page.locator('#voice-input-device').select_option(device)
 page.wait_for_function("LyriaVoice.getInputDevice()!==''");assert page.evaluate('LyriaVoice.getInputDevice()')==device
 page.reload();page.wait_for_function("document.getElementById('voice-input-device').value===LyriaVoice.getInputDevice()")
 assert page.evaluate('__captures')==0
 assert not errors,errors
 page.close();browser.close()
print('PASS: no automatic capture, relay warning without microphone access, local microphone test/stop, device selection and persistence, no call created.')
