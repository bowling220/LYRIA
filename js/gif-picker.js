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
  function render(){
    const items=library.search($('gif-search').value,modal.dataset.category || 'All');
    const grid=$('gif-results');grid.replaceChildren();
    $('gif-results-count').textContent=items.length+' GIF'+(items.length===1?'':'s');
    $('gif-no-results').hidden=Boolean(items.length);
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
  function compact(){const height=window.visualViewport?.height || window.innerHeight;modal.classList.toggle('gif-compact',height<620);modal.classList.toggle('gif-extra-compact',height<420);}
  window.visualViewport?.addEventListener('resize',compact);window.addEventListener('resize',compact);
  function open(next){
    compact();
    version++;options=next;selected=null;previewReady=false;busy=false;
    modal.dataset.category='All';$('gif-search').value='';$('gif-selection').hidden=true;$('gif-selection-idle').hidden=false;$('gif-picker-action').disabled=true;
    $('gif-modal-title').textContent=next.title || 'Find the right GIF';$('gif-picker-action').textContent=next.action || 'Send GIF';
    $('gif-picker-description').textContent=next.description || 'Search the built-in library, choose a GIF, then send it.';
    $('gif-library-source').textContent='Built-in library · '+library.count+' GIFs · Media hosted by GIPHY';
    $('gif-categories').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.category==='All')));
    feedback('');render();UI.openModal(modal);
  }
  for(const category of library.categories){const button=document.createElement('button');button.type='button';button.textContent=category;button.dataset.category=category;button.setAttribute('aria-pressed',String(category==='All'));button.addEventListener('click',()=>{if(busy)return;modal.dataset.category=category;for(const chip of $('gif-categories').children)chip.setAttribute('aria-pressed',String(chip===button));render()});$('gif-categories').append(button);}
  $('gif-search').addEventListener('input',()=>{if(!busy)render()});
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
    if(wasOpen && !visible){version++;busy=false;modal.removeAttribute('aria-busy');const onClose=options?.onClose;options=null;const image=$('gif-selection-image');image.onload=null;image.onerror=null;image.removeAttribute('src');onClose?.();}
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
    render();const item=typeof data.selected==='string'?library.get(data.selected):null;if(item)select(item);
  }
  window.LyriaGifPicker={open,capture,restore};
})();
