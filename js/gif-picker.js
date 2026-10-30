/* One accessible library picker for chat, avatar, and banner selections. */
(() => {
  const $=id=>document.getElementById(id), library=window.LyriaGifLibrary, UI=window.LyriaUI;
  const modal=$('gif-modal');let options,selected,previewReady=false,busy=false,wasOpen=false,version=0;
  function feedback(text,kind='info'){const el=$('gif-picker-feedback');el.textContent=text;el.dataset.state=kind;}
  function select(item){
    selected=item;previewReady=false;$('gif-picker-action').disabled=true;
    document.querySelectorAll('.gif-library-tile').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.gifId===item.id)));
    $('gif-selection').hidden=false;$('gif-selection-idle').hidden=true;$('gif-selection-title').textContent=item.title;
    const image=$('gif-selection-image');image.dataset.managedMedia='true';image.hidden=false;
    image.onload=()=>{previewReady=true;$('gif-picker-action').disabled=busy;feedback(options?.hint || 'Ready when you are.');};
    image.onerror=()=>{previewReady=false;$('gif-picker-action').disabled=true;feedback('Preview couldn’t load. Choose another GIF or try again.','error');};
    image.src=item.previewUrl;feedback('Loading GIF preview…');
  }
  function renderItems(items,append=false){
    const grid=$('gif-results');if(!append)grid.replaceChildren();
    $('gif-results-count').textContent=(append?grid.children.length+items.length:items.length)+' GIFs';
    $('gif-no-results').hidden=Boolean(items.length || (append && grid.children.length));
    for(const item of items){
      const button=document.createElement('button');button.type='button';button.className='gif-library-tile';button.dataset.gifId=item.id;
      button.setAttribute('aria-label','Select '+item.title+' GIF');button.setAttribute('aria-pressed',String(selected?.id===item.id));
      const image=document.createElement('img');image.dataset.managedMedia='true';image.alt='';image.loading='lazy';image.width=item.width;image.height=item.height;image.referrerPolicy='no-referrer';image.src=item.stillUrl;
      image.onerror=()=>{image.hidden=true;button.classList.add('gif-thumbnail-unavailable');};
      image.onload=()=>{image.hidden=false;button.classList.remove('gif-thumbnail-unavailable');};
      button.addEventListener('pointerenter',()=>{if(!window.LyriaMedia.reduced())image.src=item.previewUrl});
      button.addEventListener('pointerleave',()=>{image.src=item.stillUrl});
      button.addEventListener('focus',()=>{if(!window.LyriaMedia.reduced())image.src=item.previewUrl});
      button.addEventListener('blur',()=>{image.src=item.stillUrl});
      const title=document.createElement('span');title.textContent=item.title;button.append(image,title);
      button.addEventListener('click',()=>{if(!busy)select(item)});grid.append(button);
    }
  }
  let request,searchTimer,nextOffset=null,loading=false,generation=0,pendingSelection=null;
  const more=document.createElement('button');more.type='button';more.className='secondary-action gif-load-more';more.textContent='Load more GIFs';more.hidden=true;
  $('gif-results').parentElement.append(more);
  async function loadPage(append=false){
    const current=generation;loading=true;more.disabled=true;more.hidden=false;more.textContent='Loading GIFs…';
    request=new AbortController();
    try{
      // Fill a generous initial batch using provider-sized pages, painting each
      // page immediately. Smaller provider responses can still reach 100 results.
      let cursor=append?nextOffset:0,received=0,pages=0;
      const seen=new Set(append?Array.from($('gif-results').children,el=>el.dataset.gifId):[]);
      while(cursor!==null && received<100 && pages++<8){
        const result=await library.browse($('gif-search').value,modal.dataset.category || 'All',cursor,request.signal);
        if(current!==generation)return;
        const unique=result.items.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true});
        renderItems(unique,append || pages>1);received+=unique.length;
        if(pendingSelection && library.get(pendingSelection)){select(library.get(pendingSelection));pendingSelection=null;}
        // A non-advancing provider cursor must never cause an infinite request loop.
        nextOffset=result.next!==null && result.next>cursor?result.next:null;
        cursor=nextOffset;
      }
      more.hidden=nextOffset===null;more.textContent='Load more GIFs';feedback('');
    }catch(error){if(current!==generation || error.name==='AbortError')return;feedback(error.message,'error');more.hidden=false;more.textContent='Retry loading GIFs';}
    finally{if(current===generation){loading=false;more.disabled=false;}}
  }
  function render(){
    clearTimeout(searchTimer);request?.abort();generation++;nextOffset=null;loading=false;
    if(!library.online()){more.hidden=true;renderItems(library.search($('gif-search').value,modal.dataset.category || 'All'));return;}
    $('gif-results').replaceChildren();$('gif-no-results').hidden=true;$('gif-results-count').textContent='Searching GIPHY…';loadPage();
  }
  more.addEventListener('click',()=>{if(!loading)loadPage(nextOffset!==null)});
  function compact(){const height=window.visualViewport?.height || window.innerHeight;modal.classList.toggle('gif-compact',height<620);modal.classList.toggle('gif-extra-compact',height<420);}
  window.visualViewport?.addEventListener('resize',compact);window.addEventListener('resize',compact);
  function open(next){
    compact();
    version++;pendingSelection=null;options=next;selected=null;previewReady=false;busy=false;
    modal.dataset.category='All';$('gif-search').value='';$('gif-selection').hidden=true;$('gif-selection-idle').hidden=false;$('gif-picker-action').disabled=true;
    $('gif-modal-title').textContent=next.title || 'Find the right GIF';$('gif-picker-action').textContent=next.action || 'Send GIF';
    $('gif-picker-description').textContent=next.description || 'Search GIFs, choose one, then send it.';
    $('gif-library-source').textContent=library.online()?'Powered by GIPHY · Search and browse more GIFs':'Built-in collection · Full GIPHY search is not configured';
    $('gif-categories').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.category==='All')));
    feedback('');render();UI.openModal(modal);
  }
  for(const category of library.categories){const button=document.createElement('button');button.type='button';button.textContent=category;button.dataset.category=category;button.setAttribute('aria-pressed',String(category==='All'));button.addEventListener('click',()=>{if(busy)return;modal.dataset.category=category;for(const chip of $('gif-categories').children)chip.setAttribute('aria-pressed',String(chip===button));render()});$('gif-categories').append(button);}
  $('gif-search').addEventListener('input',()=>{if(busy)return;request?.abort();generation++;clearTimeout(searchTimer);if(library.online())searchTimer=setTimeout(render,300);else render()});
  $('gif-picker-action').addEventListener('click',async()=>{
    if(busy || !selected || !previewReady)return;
    const current=version,action=options.onSelect,item=library.get(selected.id);
    busy=true;$('gif-picker-action').disabled=true;modal.setAttribute('aria-busy','true');feedback('Working…');
    try{await action(item);if(current===version)UI.closeModal(modal);}
    catch(error){console.error(error);if(current===version)feedback(error.message || 'Could not use this GIF. Please try again.','error');}
    finally{if(current===version){busy=false;modal.removeAttribute('aria-busy');$('gif-picker-action').disabled=!previewReady;}}
  });
  new MutationObserver(()=>{
    const visible=modal.style.display==='flex';
    if(wasOpen && !visible){request?.abort();generation++;clearTimeout(searchTimer);version++;busy=false;modal.removeAttribute('aria-busy');const onClose=options?.onClose;options=null;const image=$('gif-selection-image');image.onload=null;image.onerror=null;image.removeAttribute('src');onClose?.();}
    wasOpen=visible;
  }).observe(modal,{attributes:true,attributeFilter:['style']});
  $('gif-button').addEventListener('click',()=>open({title:'Say it with a GIF',action:'Send GIF',onSelect:async item=>{
    if(typeof window.sendLibraryGif!=='function')throw new Error('Wait for your conversation to finish loading.');
    await window.sendLibraryGif(item.id);UI.notify('GIF sent.','success');
  }}));
  function capture(){return {target:options?.context || 'message',search:$('gif-search').value,category:modal.dataset.category,selected:selected?.id}}
  function restore(data){
    const trigger={message:'gif-button',avatar:'choose-avatar-gif',banner:'choose-banner-gif'}[data.target];if(!trigger)return;
    $(trigger).click();
    $('gif-search').value=typeof data.search==='string'?data.search.slice(0,160):'';
    modal.dataset.category=library.categories.includes(data.category)?data.category:'All';
    for(const chip of $('gif-categories').children)chip.setAttribute('aria-pressed',String(chip.dataset.category===modal.dataset.category));
    render();const item=typeof data.selected==='string'?library.get(data.selected):null;if(item)select(item);else pendingSelection=typeof data.selected==='string'?data.selected:null;
  }
  window.LyriaGifPicker={open,capture,restore};
})();
