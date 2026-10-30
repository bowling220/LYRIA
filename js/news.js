import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {connectFirestoreEmulator,initializeFirestore,doc,onSnapshot,getDoc,collection,addDoc,query,orderBy,getDocs,limit,startAfter,runTransaction} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {connectAuthEmulator,getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {archiveStories} from './news-archive.js?v=b51710d80e8ae71e';
import {categories,categoryOf,dateValue,readingMinutes,excerptOf,safeImage,normalizeStory,newestFirst} from './news-model.js?v=7671fc6656542c4b';
        // Load environment variables for security
        window.env = window.env || {
            VITE_FIREBASE_API_KEY: "AIzaSyDWpApnJ-mfHQJZhkbNDdsJ7l8-8rVHHTc",
            VITE_FIREBASE_AUTH_DOMAIN: "lyria-49a54.firebaseapp.com",
            VITE_FIREBASE_PROJECT_ID: "lyria-49a54",
            VITE_FIREBASE_STORAGE_BUCKET: "lyria-49a54.firebasestorage.app",
            VITE_FIREBASE_MESSAGING_SENDER_ID: "704449928785",
            VITE_FIREBASE_APP_ID: "1:704449928785:web:5b3c58c8f82d31d3f1a270",
            VITE_FIREBASE_MEASUREMENT_ID: "G-KV5FRFN63T"
        };

        const firebaseConfig = {
            apiKey: window.env.VITE_FIREBASE_API_KEY,
            authDomain: window.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: window.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: window.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: window.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: window.env.VITE_FIREBASE_APP_ID,
            measurementId: window.env.VITE_FIREBASE_MEASUREMENT_ID
        };

        // Initialize Firebase
        const runtime=window.LYRIA_RUNTIME;
        if(runtime?.origin && location.origin!==runtime.origin)throw new Error('This build is configured for a different site.');
        const app = initializeApp(runtime?.firebase || firebaseConfig);
        const db = initializeFirestore(app, {experimentalForceLongPolling:true,useFetchStreams:false});
        const auth = getAuth(app);
        if(runtime?.emulators){connectFirestoreEmulator(db,runtime.emulators.host,runtime.emulators.firestorePort);connectAuthEmulator(auth,'http://'+runtime.emulators.host+':'+runtime.emulators.authPort,{disableWarnings:true})}
        const newsAuthReady = new Promise(resolve => {
            let unsubscribe = () => {};
            unsubscribe = onAuthStateChanged(auth, user => {
                unsubscribe();
                resolve(user);
            });
        });

        async function getNewsUser(showPrompt = false) {
            await newsAuthReady;
            const user = auth.currentUser;
            if (!user && showPrompt) window.LyriaUI.notify('Sign in to like or comment on LYRIA News.');
            return user;
        }


const $=id=>document.getElementById(id), UI=window.LyriaUI;
const members=new Map(), pageSize=24, blockedWriters=new Set(['','dOVyjlLfVXPA9cWO2VCxR5zfgKW2']);
let filter=new URLSearchParams(location.search).get('category') || 'all',visible=6,cursor=null,hasMore=false,feedOff=null,firstPageIds=[],feedGeneration=0,routeVersion=0,engagementOff=[],publishBusy=false,writerProfile=null,writerUid=null;
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node};
const icon=name=>{const node=el('span');node.innerHTML=UI.icon(name);node.setAttribute('aria-hidden','true');return node};
const allStories=()=>[...archiveStories,...members.values()].sort(newestFirst);
const storyById=id=>archiveStories.find(story=>story.id===id) || members.get(id);
const dateText=value=>dateValue(value)?.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) || 'Date unavailable';
const storyUrl=id=>{const url=new URL(location.href);url.searchParams.set('story',id);return url.pathname+url.search};
const clearEngagement=()=>{engagementOff.forEach(stop=>stop?.());engagementOff=[]};
const isReader=()=>!$('journal-reader').hidden;
function cover(story,{hero=false,eager=false}={}){
 const art=el('div','journal-cover journal-cover-'+categoryOf(story));
 const pattern=el('div','journal-cover-pattern');pattern.setAttribute('aria-hidden','true');pattern.append(icon(story.archive?'news':'chat'),el('span','','LYRIA / JOURNAL'));art.append(pattern);
 const url=safeImage(story.imageURL || story.image);art.classList.toggle('journal-cover-archive',Boolean(story.archive && url));
 if(url){const image=el('img');image.src=url;image.alt=story.imageAlt || story.title;image.loading=eager?'eager':'lazy';image.decoding='async';image.addEventListener('load',()=>art.classList.add('has-image'));image.addEventListener('error',()=>image.remove());art.append(image)}
 art.classList.toggle('journal-cover-hero',hero);return art;
}
function byline(story){
 const box=el('div','journal-byline'),avatar=el('span','journal-author-avatar',String(story.authorName || 'LYRIA').slice(0,1).toUpperCase());
 const src=safeImage(story.authorPhotoURL);if(src){const image=el('img');image.alt='';image.src=src;image.loading='lazy';image.addEventListener('error',()=>image.remove());avatar.append(image)}
 const details=el('span','journal-author-details');details.append(el('span','journal-author-name',story.authorName || 'LYRIA community'));
 const meta=el('span','journal-meta');const time=el('time','',dateText(story.date));const parsed=dateValue(story.date);if(parsed)time.dateTime=parsed.toISOString();meta.append(time,el('span','',readingMinutes(story.body)+' min read'));details.append(meta);box.append(avatar,details);return box;
}
function listenLikes(story,count,button){
 const postId=story.postId || story.commentId;
 const off=onSnapshot(doc(db,'posts',postId),snap=>{if(!count.isConnected)return;count.hidden=false;count.textContent=String(Math.max(0,Number(snap.data()?.likes)||0));count.setAttribute('aria-label',count.textContent+' likes')},()=>{count.hidden=true});engagementOff.push(off);
 if(button){getNewsUser().then(async user=>{if(!button.isConnected || !user)return;if(auth.currentUser?.uid!==user.uid)return;const stop=onSnapshot(doc(db,'userLikes',user.uid,'likes',postId),snap=>{if(button.isConnected)paintLike(button,Boolean(snap.data()?.liked))},()=>{});engagementOff.push(stop)}).catch(()=>{});button.addEventListener('click',()=>toggleLike(story,button))}
}
function card(story,featured=false){
 const article=el('article',(featured?'journal-feature':'journal-card')+(story.archive?'':' user-submitted'));article.dataset.storyId=story.id;
 const link=el('a','journal-story-link');link.href=storyUrl(story.id);link.dataset.story=story.id;
 link.append(cover(story,{eager:featured}));const copy=el('div','journal-story-copy');
 const label=el('div','journal-story-label');label.append(el('span','journal-category',categories[categoryOf(story)]));if(featured)label.append(el('span','journal-feature-label','Featured story'));
 const title=el(featured?'h2':'h3','',story.title);copy.append(label,title,el('p','journal-excerpt',excerptOf(story)),byline(story));
 const stats=el('span','journal-card-stats');const count=el('span');count.hidden=true;stats.append(icon('heart'),count);copy.append(stats);listenLikes(story,count);
 if(featured){const read=el('span','journal-read-link','Read the story');read.append(icon('arrow'));copy.append(read)}
 link.append(copy);article.append(link);return article;
}
function filters(){
 const host=$('journal-filters');host.replaceChildren();const present=new Set(allStories().map(categoryOf));
 for(const id of ['all',...Object.keys(categories).filter(id=>present.has(id))]){
  const button=el('button','journal-filter',id==='all'?'All stories':categories[id]);button.type='button';button.dataset.category=id;button.setAttribute('aria-pressed',String(filter===id));
  button.addEventListener('click',()=>{filter=id;visible=6;const url=new URL(location.href);if(id==='all')url.searchParams.delete('category');else url.searchParams.set('category',id);url.searchParams.delete('story');history.pushState({},'',url);renderHome();host.querySelector('[data-category="'+id+'"]')?.focus()});host.append(button);
 }
}
function empty(text,detail){const box=el('div','journal-empty');box.append(icon('news'),el('h2','',text),el('p','',detail));return box}
function renderHome(){
 if(isReader())return;
 clearEngagement();filters();const stories=allStories().filter(story=>filter==='all' || categoryOf(story)===filter);
 $('journal-featured').replaceChildren();$('journal-grid').replaceChildren();
 if(stories.length){$('journal-featured').append(card(stories[0],true));stories.slice(1,visible+1).forEach(story=>$('journal-grid').append(card(story)))}
 else $('journal-featured').append(empty(filter==='all'?'No stories yet':'No stories in this category','Try another category, or share the first story.'));
 $('journal-story-count').textContent=stories.length?(stories.length+' stories'+(hasMore?' loaded':'')):'';
 $('journal-more').hidden=stories.length<=visible+1 && !hasMore;
 $('journal-latest')?.classList.toggle('is-empty',stories.length<=1);
 document.title='The Community Journal — LYRIA';
}
function feedStatus(text,error=false){const host=$('journal-load-status');host.replaceChildren();host.hidden=!text;host.append(el('span','',text));if(error){const button=el('button','','Try again');button.type='button';button.addEventListener('click',startFeed);host.append(button)}}
function startFeed(){
 feedOff?.();const generation=++feedGeneration;feedStatus('Loading community stories…');
 const timer=setTimeout(()=>{if(generation===feedGeneration)feedStatus('Community stories are taking longer to load. The LYRIA archive is still available.',true)},15000);
 feedOff=onSnapshot(query(collection(db,'userArticles'),orderBy('timestamp','desc'),limit(pageSize)),snapshot=>{
  clearTimeout(timer);if(generation!==feedGeneration)return;
  firstPageIds.forEach(id=>members.delete(id));firstPageIds=[];
  snapshot.forEach(snap=>{const story=normalizeStory(snap.id,snap.data());members.set(story.id,story);firstPageIds.push(story.id)});
  cursor=snapshot.docs.at(-1) || null;hasMore=snapshot.docs.length===pageSize;feedStatus('');renderHome();
 },()=>{clearTimeout(timer);if(generation===feedGeneration)feedStatus('Community stories couldn’t load. You can still read the LYRIA archive.',true)});
}
$('journal-more').addEventListener('click',async()=>{
 const button=$('journal-more');button.disabled=true;
 try{if(visible+1>=allStories().filter(s=>filter==='all' || categoryOf(s)===filter).length && hasMore && cursor){const snap=await getDocs(query(collection(db,'userArticles'),orderBy('timestamp','desc'),startAfter(cursor),limit(pageSize)));snap.forEach(doc=>{const story=normalizeStory(doc.id,doc.data());members.set(story.id,story)});cursor=snap.docs.at(-1) || cursor;hasMore=snap.docs.length===pageSize}visible+=6;renderHome()}
 catch{feedStatus('More stories couldn’t load. Please try again.',true)}finally{button.disabled=false}
});
function paintLike(button,liked){button.replaceChildren(icon('heart'),document.createTextNode(liked?'Liked':'Like this story'));button.classList.toggle('liked',liked);button.setAttribute('aria-pressed',String(liked))}
async function toggleLike(story,button){
 if(button.disabled)return;button.disabled=true;
 try{const user=await getNewsUser(true);if(!user)return;const id=story.postId || story.commentId,like=doc(db,'userLikes',user.uid,'likes',id),post=doc(db,'posts',id);const liked=await runTransaction(db,async transaction=>{const [mine,total]=await Promise.all([transaction.get(like),transaction.get(post)]);const wasLiked=Boolean(mine.data()?.liked);const current=Math.max(0,Number(total.data()?.likes)||0);transaction.set(post,{likes:Math.max(0,current+(wasLiked?-1:1))},{merge:true});transaction.set(like,{liked:!wasLiked});return !wasLiked});if(button.isConnected)paintLike(button,liked);
 }catch{UI.notify('Could not save your reaction. Please try again.','error')}finally{button.disabled=false}
}
function inlineText(parent,text){
 const parts=String(text).split(/(https?:\/\/[^\s<>]+)/g);
 for(const part of parts){if(/^https?:\/\//.test(part)){const a=el('a','',part);a.href=part;a.rel='noopener noreferrer';parent.append(a)}else parent.append(document.createTextNode(part))}
}
function articleBody(story){
 const body=el('div','journal-prose');
 if(story.archive){const template=document.createElement('template');template.innerHTML=story.bodyHtml;template.content.querySelectorAll('img').forEach(image=>{if(image.getAttribute('src')===story.imageURL){const gallery=image.closest('.image-gallery');image.remove();if(gallery && !gallery.children.length)gallery.remove();return}image.removeAttribute('style');image.loading='lazy';image.addEventListener('error',()=>image.replaceWith(el('p','journal-image-missing','This archived illustration is unavailable.')))});body.append(template.content);return body}
 let list=null,code=null;
 for(const block of story.body.split(/\n\s*\n/)){
  for(const line of block.split('\n')){
   if(line.trim().startsWith('```')){if(code)code=null;else{const pre=el('pre');code=el('code');pre.append(code);body.append(pre)}continue}
   if(code){code.textContent+=line+'\n';continue}
   const heading=line.match(/^(#{1,3})\s+(.+)/);const item=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
   if(heading){list=null;body.append(el('h'+Math.min(4,Math.max(2,heading[1].length)),'',heading[2]))}
   else if(item){const tag=/^\s*\d/.test(line)?'ol':'ul';if(!list || list.tagName.toLowerCase()!==tag){list=el(tag);body.append(list)}const li=el('li');inlineText(li,item[1]);list.append(li)}
   else if(line.startsWith('> ')){list=null;const quote=el('blockquote');inlineText(quote,line.slice(2));body.append(quote)}
   else if(line.trim()){list=null;const p=el('p');inlineText(p,line);body.append(p)}
  }
  list=null;
 }
 return body;
}
function comments(story){
 const section=el('section','journal-discussion');section.setAttribute('aria-labelledby','discussion-title');section.append(el('h2','','Join the conversation'));section.firstChild.id='discussion-title';
 const form=el('form','journal-comment-form'),label=el('label','','Your comment'),input=el('textarea');input.id='comment-input-'+story.commentId;input.rows=3;input.maxLength=2000;input.required=true;label.htmlFor=input.id;input.placeholder='Add something to the conversation…';const button=el('button','primary-action','Post comment');button.type='submit';const status=el('p','journal-comment-status');status.setAttribute('role','status');form.append(label,input,button,status);section.append(form);
 const list=el('div','journal-comments');list.id='comments-list-'+story.commentId;list.setAttribute('aria-live','polite');list.append(el('p','journal-muted','Loading comments…'));section.append(list);
 const off=onSnapshot(query(collection(db,'articles',story.commentId,'comments'),orderBy('timestamp','desc'),limit(100)),snapshot=>{
  if(!list.isConnected)return;list.replaceChildren();if(snapshot.empty)list.append(el('p','journal-muted','No comments yet. Start the conversation.'));
  snapshot.forEach(snap=>{const data=snap.data(),row=el('article','journal-comment');const header=el('header');header.append(el('strong','',data.username || 'LYRIA member'),el('time','',dateText(data.timestamp)));row.append(header,el('p','',data.text || ''));list.append(row)});
  if(snapshot.docs.length===100)list.append(el('p','journal-muted','Showing the latest 100 comments.'));
 },()=>{const retry=el('button','','Retry comments');retry.type='button';retry.addEventListener('click',()=>{const draft=input.value;route().then(()=>{const next=$('comment-input-'+story.commentId);if(next)next.value=draft})});list.replaceChildren(el('p','journal-muted','Comments couldn’t load. Please try again.'),retry)});engagementOff.push(off);
 form.addEventListener('submit',async event=>{event.preventDefault();const text=input.value.trim();if(!text || button.disabled)return;button.disabled=true;
  try{const user=await getNewsUser(true);if(!user){status.textContent='Sign in to post your comment.';return}await addDoc(collection(db,'articles',story.commentId,'comments'),{text,timestamp:new Date().toISOString(),userId:user.uid,username:user.displayName || (user.isAnonymous?'Guest':'LYRIA member')});input.value='';status.textContent='Comment posted.'}
  catch{status.textContent='Your comment was not posted. Please try again.'}finally{button.disabled=false}
 });return section;
}
function renderReader(story){
 clearEngagement();const host=$('journal-reader');host.replaceChildren();
 const back=el('a','journal-back','Back to the journal');const backURL=new URL(location.href);backURL.searchParams.delete('story');back.href=backURL.pathname+backURL.search;back.dataset.journalBack='true';back.prepend(icon('back'));host.append(back);
 const article=el('article','journal-article');article.dataset.storyId=story.id;const header=el('header','journal-article-header');header.append(el('p','journal-category',categories[categoryOf(story)]));const title=el('h1','',story.title);title.id='reader-title';title.tabIndex=-1;header.append(title);
 if(story.excerpt)header.append(el('p','journal-deck',story.excerpt));header.append(byline(story));article.append(header,cover(story,{hero:true,eager:true}));
 const reading=el('div','journal-reading-column');if(story.archive)reading.append(el('p','journal-archive-note','From the LYRIA archive · Originally published '+dateText(story.date)+'. This story reflects the product at that time.'));
 reading.append(articleBody(story));
 if(Array.isArray(story.tags) && story.tags.length){const tags=el('ul','journal-tags');for(const tag of story.tags.slice(0,10))tags.append(el('li','',String(tag)));reading.append(tags)}
 const reactions=el('div','journal-reactions'),button=el('button','journal-like'),count=el('span');button.type='button';button.id=(story.postId || story.commentId)+'-like-button';paintLike(button,false);count.hidden=true;reactions.append(button,count,el('span','journal-muted','Appreciate the story? Leave a little love.'));reading.append(reactions,comments(story));article.append(reading);host.append(article);listenLikes(story,count,button);
 const related=allStories().filter(item=>item.id!==story.id).sort((a,b)=>(Number(categoryOf(b)===categoryOf(story))-Number(categoryOf(a)===categoryOf(story))) || newestFirst(a,b)).slice(0,3);
 if(related.length){const section=el('section','journal-related');section.append(el('h2','','More from LYRIA'));const grid=el('div','journal-grid');related.forEach(item=>grid.append(card(item)));section.append(grid);host.append(section)}
 document.title=story.title+' — LYRIA Journal';
}
async function route({focus=false}={}){
 const version=++routeVersion,id=new URLSearchParams(location.search).get('story');filter=new URLSearchParams(location.search).get('category') || 'all';
 clearEngagement();$('journal-home').hidden=Boolean(id);$('journal-reader').hidden=!id;
 if(!id){renderHome();if(focus)$('journal-main').focus({preventScroll:true});return}
 let story=storyById(id);
 if(!story && id.startsWith('member-') && /^[A-Za-z0-9_-]{1,180}$/.test(id.slice(7))){$('journal-reader').replaceChildren(empty('Opening your story…','Getting the latest version.'));try{const snap=await getDoc(doc(db,'userArticles',id.slice(7)));if(snap.exists()){story=normalizeStory(snap.id,snap.data());members.set(story.id,story)}}catch{if(version===routeVersion){const error=empty('This story couldn’t load','Check your connection and try again.');const retry=el('button','','Try again');retry.addEventListener('click',()=>route({focus:true}));error.append(retry);$('journal-reader').replaceChildren(error)}return}}
 if(version!==routeVersion)return;
 if(!story){const missing=empty('That story isn’t available','It may have moved, or the link may be incomplete.');const back=el('a','journal-read-link','Back to the journal');back.href='News.html';back.dataset.journalBack='true';missing.append(back);$('journal-reader').replaceChildren(missing);return}
 renderReader(story);if(focus)$('reader-title').focus({preventScroll:true});
}
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-story],a[data-journal-back]');if(!link || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
 event.preventDefault();history.replaceState({...history.state,scrollY:window.scrollY},'');history.pushState({scrollY:0},'',link.href);route({focus:true});window.scrollTo(0,0);
});
window.addEventListener('popstate',()=>{route().then(()=>requestAnimationFrame(()=>window.scrollTo(0,history.state?.scrollY || 0)))});
async function openWriter(){
 const user=await getNewsUser();if(!user){UI.notify('Sign in to publish a story.');return}if(blockedWriters.has(user.uid)){UI.notify('You do not have permission to create articles.');return}
 if(writerUid!==user.uid){writerProfile=null;writerUid=user.uid;$('article-author').value=''}
 UI.openModal($('user-article-section'));if(!$('article-author').value)$('article-author').value=user.displayName || (user.isAnonymous?'Guest':'LYRIA member');
 getDoc(doc(db,'users',user.uid)).then(snap=>{if(auth.currentUser?.uid===user.uid)writerProfile=snap.data() || null}).catch(()=>{});
}
window.toggleUserArticles=openWriter;
$('create-article-button').addEventListener('click',openWriter);
onAuthStateChanged(auth,user=>{$('create-article-button').hidden=Boolean(user && blockedWriters.has(user.uid));if(!user)writerProfile=null});
$('article-form').addEventListener('submit',async event=>{
 event.preventDefault();if(publishBusy)return;const user=await getNewsUser();if(publishBusy)return;if(!user || blockedWriters.has(user.uid)){UI.notify('Sign in with an account allowed to publish.');return}
 const title=$('article-title').value.trim(),body=$('article-body').value.trim(),image=$('article-image').value.trim();
 if(!title || !body || title.length>160 || body.length>30000 || (image && !safeImage(image))){$('article-publish-status').textContent='Add a headline and story, and use a valid HTTPS cover image.';return}
 publishBusy=true;const button=$('article-form').querySelector('[type=submit]');button.disabled=true;$('article-publish-status').textContent='Publishing your story…';
 const payload={authorName:$('article-author').value.trim() || user.displayName || 'LYRIA member',authorId:user.uid,authorPhotoURL:safeImage(writerProfile?.photoURL || user.photoURL),title,body,category:$('article-category').value,excerpt:$('article-excerpt').value.trim(),imageURL:safeImage(image),tags:$('article-tags').value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,10),readingMinutes:readingMinutes(body),timestamp:new Date().toISOString()};
 try{const result=await addDoc(collection(db,'userArticles'),payload);const story=normalizeStory(result.id,payload);members.set(story.id,story);$('article-form').reset();UI.closeModal($('user-article-section'));$('article-publish-status').textContent='';history.pushState({scrollY:0},'',storyUrl(story.id));route({focus:true});window.scrollTo(0,0);UI.notify('Your story is published.')}
 catch{$('article-publish-status').textContent='Your story wasn’t published. Your draft is still here; please try again.'}finally{publishBusy=false;button.disabled=false}
});
window.addEventListener('pagehide',()=>{feedOff?.();clearEngagement()});
window.addEventListener('pageshow',event=>{if(event.persisted){startFeed();route()}});
route();startFeed();
