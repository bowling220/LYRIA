"""Focused local smoke test for the avatar decoration customizer."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'test-artifacts'
OUTPUT.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
    page=make_page(browser,ROOT,1100,760,False)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://localhost:8124/home.html?channel=community',wait_until='load')
    page.locator('#settings-btn').click()
    page.locator('#open-avatar-decoration').click()
    page.locator('[data-decoration="blossom"].decoration-option').click()
    assert page.locator('#decoration-preview').get_attribute('data-decoration')=='blossom'
    assert page.locator('#apply-avatar-decoration').is_enabled()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.locator('#avatar-decoration-modal').screenshot(path=str(OUTPUT/'profile-decorations.png'))
    page.locator('#apply-avatar-decoration').click()
    page.wait_for_timeout(100)
    assert page.locator('#user-avatar-decoration').get_attribute('data-decoration')=='blossom'
    assert not errors,errors
    browser.close()

print('Profile decoration smoke test passed.')
