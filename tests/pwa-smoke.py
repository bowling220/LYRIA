"""Install the local app shell, disconnect, and prove the landing page still starts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from browser_executable import CHROMIUM
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]/'dist'/'client'
assert (ROOT/'manifest.webmanifest').is_file(), 'Run npm run build before the PWA smoke test.'

class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=ROOT))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,args=['--no-sandbox'])
  context=browser.new_context()
  page=context.new_page();base=f'http://127.0.0.1:{server.server_port}'
  page.goto(base+'/index.html',wait_until='load')
  manifest=page.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
  assert manifest['display']=='standalone'
  assert {icon['sizes'] for icon in manifest['icons']}>={'192x192','512x512'}
  page.evaluate("navigator.serviceWorker.ready")
  page.reload(wait_until='load')
  page.wait_for_function('navigator.serviceWorker.controller !== null')
  context.set_offline(True)
  page.reload(wait_until='domcontentloaded')
  assert page.get_by_role('heading',name='Your people are here. Say something.').is_visible()
  assert page.locator('link[rel=manifest]').get_attribute('href')=='manifest.webmanifest'
  context.set_offline(False);browser.close()
 print('PASS: install manifest, active service worker and offline app-shell startup')
finally:server.shutdown()
