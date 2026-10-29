/* Library GIFs and original image uploads for profile pictures and banners. */
(() => {
  const $=id=>document.getElementById(id),UI=window.LyriaUI,media=window.LyriaMedia;
  const targets={avatar:{field:'photoURL',meta:'avatarGif',input:'profile-image-input',save:'update-profile-image',status:'image-save-status',limit:250000},banner:{field:'bannerURL',meta:'bannerGif',input:'profile-banner-input',save:'update-profile-banner',status:'banner-save-status',limit:350000}};
  const drafts={},revision={},reading={};let profile=window.LyriaAccount.getProfile(),busy={};
  function feedback(target,text,state='dirty'){const el=$(targets[target].status);el.textContent=text;el.dataset.state=state;}
  function render(next){
    profile=next || {};
    const draftProfile={...profile};for(const [target,draft]of Object.entries(drafts)){draftProfile[targets[target].field]=draft.url;draftProfile[targets[target].meta]=draft.gif || null;}
    media.image($('appearance-avatar'),media.profileSource(draftProfile,'avatar'),'assets/avatar.svg');
    media.profileBanner($('appearance-banner'),draftProfile);
    for(const target of Object.keys(targets)){
      $(targets[target].save).disabled=Boolean(busy[target]) || Boolean(reading[target]) || !drafts[target];
      document.querySelectorAll('[data-media-target="'+target+'"] input, [data-media-target="'+target+'"] button:not(#'+targets[target].save+')').forEach(el=>el.disabled=Boolean(busy[target]));
    }
  }
  function setDraft(target,url,gif){revision[target]=(revision[target]||0)+1;reading[target]=false;if(gif?.provider!=='upload')$(targets[target].input).value='';drafts[target]={url,gif};feedback(target,'Preview updated. Save to keep this change.');render(profile);}
  function chooseGif(target){
    UI.closeModal($('settings-modal'));
    window.LyriaGifPicker.open({context:target,title:target==='avatar'?'Find your profile GIF':'Find your banner GIF',action:'Use this GIF',description:'Choose a GIF, then preview it on your profile before saving.',onSelect:item=>setDraft(target,item.url,window.LyriaGifLibrary.metadata(item.id)),onClose:()=>{UI.openModal($('settings-modal'));}});
  }
  async function readFile(file,target){
    const config=targets[target];if(file.size>config.limit)throw new Error('Use a file under '+(config.limit/1000)+' KB, or choose a library GIF for a larger animation.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const isGif=String.fromCharCode(...bytes.slice(0,6)).match(/^GIF8[79]a$/);
    const isPng=bytes[0]===137 && String.fromCharCode(...bytes.slice(1,4))==='PNG';
    const isJpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!isGif && !isPng && !isJpeg && !isWebp)throw new Error('Choose a real GIF, PNG, JPG, or WebP image.');
    const mime=isGif?'image/gif':isPng?'image/png':isJpeg?'image/jpeg':'image/webp';
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).replace(/^data:[^;]*;/,'data:'+mime+';'));reader.onerror=()=>reject(new Error('This image could not be read.'));reader.readAsDataURL(file);});
    await new Promise((resolve,reject)=>{const image=new Image();const timer=setTimeout(()=>reject(new Error('This image took too long to open.')),10000);image.onload=()=>{clearTimeout(timer);if(image.naturalWidth>8192 || image.naturalHeight>8192)reject(new Error('Choose an image smaller than 8192 pixels per side.'));else resolve()};image.onerror=()=>{clearTimeout(timer);reject(new Error('This image could not be opened.'))};image.src=url;});
    return {url,gif:isGif?{provider:'upload',animated:true}:null};
  }
  for(const [target,config]of Object.entries(targets)){
    $('choose-'+target+'-gif').addEventListener('click',()=>chooseGif(target));
    $(config.input).addEventListener('change',async()=>{
      const file=$(config.input).files[0];if(!file || busy[target])return;
      const version=revision[target]=(revision[target]||0)+1;reading[target]=true;feedback(target,'Opening your image…','pending');render(profile);
      try{const draft=await readFile(file,target);if(version===revision[target])setDraft(target,draft.url,draft.gif);}
      catch(error){if(version===revision[target]){reading[target]=false;feedback(target,error.message,'error');$(config.input).value='';render(profile);}}
    });
    $('reset-'+target).addEventListener('click',()=>setDraft(target,target==='avatar'?'assets/avatar.svg':'',null));
    $(config.save).addEventListener('click',async()=>{
      const draft=drafts[target];if(!draft || busy[target])return;
      const patch={[config.field]:draft.url,[config.meta]:draft.gif || null};
      const estimated=new TextEncoder().encode(JSON.stringify({...profile,...patch})).length;
      if(estimated>900000){feedback(target,'Your profile is too large for both uploads. Choose a library GIF or use a smaller image.','error');return;}
      // Account.save owns the save button's disabled/busy state.
      busy[target]=true;
      document.querySelectorAll('[data-media-target="'+target+'"] input, [data-media-target="'+target+'"] button:not(#'+config.save+')').forEach(el=>el.disabled=true);
      const saved=await window.LyriaAccount.save(patch,{button:$(config.save),statusId:config.status});
      busy[target]=false;
      if(saved && drafts[target]===draft){delete drafts[target];$(config.input).value='';}
      render(window.LyriaAccount.getProfile());
    });
  }
  window.LyriaProfileMedia={render};render(profile);
})();
