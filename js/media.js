/* Shared GIF rendering and profile image sources. Never flatten saved GIF animation. */
(() => {
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safeUrl=value=>{
    if(typeof value!=='string' || !value.trim() || value.length>1500000)return '';
    if(/^data:image\/(gif|png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(value))return value;
    try{const url=new URL(value,location.href);if(url.protocol==='https:' || (url.origin===location.origin && url.protocol==='http:'))return url.href;}catch{}
    return '';
  };
  function profileSource(profile,target='avatar'){
    const gif=profile[target==='avatar'?'avatarGif':'bannerGif'];
    const item=window.LyriaGifLibrary.get(gif?.id);
    const stored=safeUrl(profile[target==='avatar'?'photoURL':'bannerURL']);
    return reduced() && safeUrl(item?.stillUrl || gif?.stillUrl)?safeUrl(item?.stillUrl || gif?.stillUrl):stored || (target==='avatar'?'assets/avatar.svg':'');
  }
  function image(img,url,fallback=''){
    img.dataset.managedMedia='true';img.referrerPolicy='no-referrer';
    img.onerror=()=>{if(fallback && img.getAttribute('src')!==fallback)img.src=fallback;else img.hidden=true;};
    img.hidden=!url;if(url)img.src=url;else img.removeAttribute('src');
  }
  function profileBanner(img,profile){image(img,profileSource(profile,'banner'));}
  function renderGif(container,message,{onLoad}={}){
    const item=window.LyriaGifLibrary.get(message.gif?.id);
    const url=safeUrl(item?.url || message.gif?.url || message.content || message.message);
    const still=safeUrl(item?.stillUrl || message.gif?.stillUrl);
    const title=item?.title || message.gif?.title || 'Shared GIF';
    const width=Number(item?.width || message.gif?.width),height=Number(item?.height || message.gif?.height);
    const card=document.createElement('figure');card.className='chat-gif';
    const frame=document.createElement('div');frame.className='chat-gif-frame';
    const img=document.createElement('img');img.dataset.managedMedia='true';img.alt=title;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    if(width>0 && height>0 && width<10000 && height<10000){img.width=width;img.height=height;frame.style.aspectRatio=width+'/'+height;}
    const caption=document.createElement('figcaption');caption.className='chat-gif-caption';
    const label=document.createElement('span');label.textContent='GIF · '+title;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='gif-motion-toggle';toggle.setAttribute('aria-label','Pause GIF');
    let paused=reduced() && Boolean(still);
    const show=()=>{img.hidden=false;img.src=paused&&still?still:url;toggle.textContent=paused?'Play':'Pause';toggle.setAttribute('aria-label',paused?'Play GIF':'Pause GIF');};
    toggle.addEventListener('click',()=>{paused=!paused;show()});toggle.hidden=!still;
    const error=document.createElement('div');error.className='gif-load-error';error.hidden=true;
    const text=document.createElement('p');text.textContent='This GIF couldn’t load.';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry GIF';
    error.append(text,retry);
    img.addEventListener('error',()=>{img.hidden=true;error.hidden=false;toggle.hidden=true;});
    img.addEventListener('load',()=>{error.hidden=true;toggle.hidden=!still;onLoad?.();});
    retry.addEventListener('click',()=>{error.hidden=true;img.hidden=false;const next=new URL(paused&&still?still:url);next.searchParams.set('lyria_retry',String(Date.now()));img.src=next.href;});
    frame.append(img,error);caption.append(label,toggle);
    const source=safeUrl(item?.sourceUrl || message.gif?.sourceUrl);
    if(source){const link=document.createElement('a');link.href=source;link.target='_blank';link.rel='noopener noreferrer';const giphy=new URL(source).hostname==='giphy.com';link.textContent=giphy?'GIPHY':'Source';link.setAttribute('aria-label',giphy?'View GIF source on GIPHY':'View GIF source');caption.append(link);}
    card.append(frame,caption);container.append(card);
    if(url)show();else{img.hidden=true;error.hidden=false;retry.hidden=true;toggle.hidden=true;}
    return card;
  }
  const messageAvatar=value=>{const url=safeUrl(value);return url && !url.startsWith('data:') && url.length<=4096?url:'assets/avatar.svg'};
  const profileBadges=(profile,uid)=>(window.LyriaBadges?.forProfile(profile,uid) || []).map(badge=>badge.id);
  window.LyriaMedia={messageAvatar,profileBadges,safeUrl,profileSource,profileBanner,image,renderGif,reduced};
})();
