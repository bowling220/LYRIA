"""Focused desktop and mobile checks for the first-account guide."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_executable import CHROMIUM
from browser_fixture import make_page

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'test-artifacts'
OUTPUT.mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
    for width,height in [(1100,760),(390,844)]:
        page=make_page(browser,ROOT,width,height,width<700)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.add_init_script("sessionStorage.setItem('lyria:onboarding-pending:test-member','1');localStorage.removeItem('lyria:onboarding:v1:test-member')")
        page.goto('http://localhost:8124/home.html?channel=community',wait_until='load')
        page.wait_for_selector('#welcome-guide:not([hidden])')
        assert page.locator('#guide-title').inner_text()=='Your conversations'
        page.locator('#guide-next').click()
        assert page.locator('#guide-title').inner_text()=="See what’s happening"
        page.keyboard.press('ArrowRight')
        assert page.locator('#guide-title').inner_text()=='Make your profile yours'
        page.locator('#welcome-guide').screenshot(path=str(OUTPUT/f'welcome-guide-{width}.png'))
        page.locator('#skip-welcome-guide').click()
        assert page.locator('#welcome-guide').is_hidden()
        assert page.evaluate("localStorage.getItem('lyria:onboarding:v1:test-member')")=='complete'
        page.locator('#settings-btn').click()
        page.locator('#replay-welcome-guide').click()
        assert page.locator('#welcome-guide').is_visible()
        assert not errors,errors
        page.close()
    browser.close()

print('First-account onboarding smoke test passed.')
