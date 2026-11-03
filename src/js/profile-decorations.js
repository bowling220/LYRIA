/* Free profile decorations with a live preview and one confirmed account save. */
(() => {
  const $=id=>document.getElementById(id),UI=window.LyriaUI;
  const decorations=Object.freeze([
    {id:'none',name:'No decoration',short:'None',description:'Keep your avatar clean and simple.'},
    {id:'meadow',name:'Meadow orbit',short:'Meadow',description:'A bright, leafy ring with LYRIA green energy.'},
    {id:'starlight',name:'Starlight',short:'Starlight',description:'A soft violet orbit for late-night conversations.'},
    {id:'ember',name:'Warm ember',short:'Ember',description:'A warm glow that feels lively without shouting.'},
    {id:'tidepool',name:'Tidepool',short:'Tidepool',description:'Cool blue ripples around your profile picture.'},
    {id:'blossom',name:'Wild blossom',short:'Blossom',description:'A playful pink frame with a tiny flower detail.'},
    {id:'eclipse',name:'Silver eclipse',short:'Eclipse',description:'A calm monochrome orbit with moonlit contrast.'}
  ]);
  const ids=new Set(decorations.map(item=>item.id));
  const clean=value=>ids.has(value)?value:'none';
  const item=value=>decorations.find(entry=>entry.id===clean(value));
  let selected='none',profile={};
  function decorate(host,value){if(host)host.dataset.decoration=clean(value)}
  function renderProfile(value){decorate($('profile-avatar-decoration'),value?.avatarDecoration)}
  function renderOwn(value){
    profile=value || {};const decoration=item(profile.avatarDecoration);
    decorate($('user-avatar-decoration'),decoration.id);
    decorate($('appearance-avatar-decoration'),decoration.id);
    if($('current-decoration-name'))$('current-decoration-name').textContent=decoration.name;
  }
  function preview(value){
    selected=clean(value);const decoration=item(selected);
    decorate($('decoration-preview'),selected);
    $('decoration-preview-name').textContent=decoration.name;
    $('decoration-preview-description').textContent=decoration.description;
    document.querySelectorAll('.decoration-option').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.decoration===selected)));
    $('apply-avatar-decoration').disabled=selected===clean(profile.avatarDecoration);
    $('decoration-save-status').textContent=selected===clean(profile.avatarDecoration)?'This decoration is already applied.':'Preview ready. Apply to save it to your profile.';
    $('decoration-save-status').dataset.state=selected===clean(profile.avatarDecoration)?'saved':'dirty';
  }
  function tile(decoration){
    const button=document.createElement('button');button.type='button';button.className='decoration-option';button.dataset.decoration=decoration.id;button.setAttribute('role','radio');
    const frame=document.createElement('span');frame.className='avatar-decoration';frame.dataset.decoration=decoration.id;
    const image=document.createElement('img');image.src='assets/avatar.svg';image.alt='';frame.append(image);
    const label=document.createElement('span');label.textContent=decoration.short;button.append(frame,label);
    button.addEventListener('click',()=>preview(decoration.id));return button;
  }
  function open(){
    profile=window.LyriaAccount.getProfile() || {};selected=clean(profile.avatarDecoration);
    $('decoration-preview-image').src=window.LyriaMedia.profileSource(profile);
    document.querySelectorAll('.decoration-option img').forEach(image=>image.src=window.LyriaMedia.profileSource(profile));
    preview(selected);UI.openModal($('avatar-decoration-modal'));
  }
  function close(){UI.closeModal($('avatar-decoration-modal'))}
  async function apply(){
    const button=$('apply-avatar-decoration');if(button.disabled)return;
    const saved=await window.LyriaAccount.save({avatarDecoration:selected},{button,statusId:'decoration-save-status'});
    if(saved){profile=window.LyriaAccount.getProfile();renderOwn(profile);renderProfile(profile);close();}
  }
  const grid=$('decoration-grid');decorations.forEach(decoration=>grid.append(tile(decoration)));
  $('open-avatar-decoration').addEventListener('click',open);
  $('close-avatar-decoration').addEventListener('click',close);
  $('cancel-avatar-decoration').addEventListener('click',close);
  $('apply-avatar-decoration').addEventListener('click',apply);
  window.addEventListener('lyria:profile-updated',event=>{renderOwn(event.detail?.profile);if($('profile-modal')?.dataset.userId===event.detail?.uid)renderProfile(event.detail?.profile)});
  window.LyriaProfileDecorations={registry:decorations,clean,renderOwn,renderProfile};
  renderOwn(window.LyriaAccount.getProfile());
})();
