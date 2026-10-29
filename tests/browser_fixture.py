"""Shared browser routing. Local files and in-memory Firebase only; no production writes."""
from pathlib import Path
import base64,mimetypes,urllib.request

def make_page(browser,root,width=390,height=844,touch=True,gif_options=None):
    page=browser.new_page(viewport={'width':width,'height':height},has_touch=touch)
    page.add_init_script(path=str(root/'tests/firebase-fixture.js'))
    options=gif_options if gif_options is not None else {}
    gif=base64.b64decode((root/'tests/fixtures/animated.gif.base64').read_text())
    def route(r):
        url=r.request.url
        if url.startswith('http://localhost:8124/'):
            file=root/url.split('8124/')[1].split('?')[0]
            if file.is_file():r.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(str(file))[0] or 'text/plain')
            else:r.fulfill(status=404,body='')
        elif 'www.gstatic.com/firebasejs/' in url and not '-compat' in url:
            names={'firebase-app.js':['initializeApp'],'firebase-auth.js':['getAuth','onAuthStateChanged'],'firebase-firestore.js':['initializeFirestore','getFirestore','doc','increment','onSnapshot','setDoc','getDoc','collection','addDoc','query','orderBy','getDocs','limit','startAfter','runTransaction']}.get(url.split('/')[-1],[])
            r.fulfill(body='\n'.join('export const '+name+'=window.__firebaseModule.'+name+';' for name in names),content_type='text/javascript')
        elif ('www.gstatic.com/firebasejs/' in url and '-compat.js' in url) or 'cdnjs.cloudflare.com/ajax/libs/peerjs/' in url:
            r.fulfill(body='/* SDK supplied by the local fixture. */',content_type='text/javascript')
        elif url.startswith('https://media.giphy.com/media/'):
            if options.get('fail_original') and '/giphy.gif' in url:r.fulfill(status=503,body='Temporarily unavailable')
            elif options.get('real_images'):
                with urllib.request.urlopen(url,timeout=15) as response:r.fulfill(body=response.read(),content_type='image/gif')
            else:r.fulfill(body=gif,content_type='image/gif')
        else:r.abort()
    page.route('**/*',route)
    return page
