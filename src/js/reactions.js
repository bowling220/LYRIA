/* Atomic per-person reactions preserve simultaneous updates from other members. */
(() => {
 const choices=[
  ['like','👍','Like'],['heart','❤️','Love'],['laugh','😂','Laugh'],['wow','😮','Wow'],
  ['sad','😢','Sad'],['celebrate','🎉','Celebrate'],['fire','🔥','Fire'],['eyes','👀','Watching'],
  ['clap','👏','Applause'],['rocket','🚀','Launch'],['hundred','💯','One hundred'],['sparkles','✨','Sparkles'],
  ['star','🌟','Star'],['crown','👑','Crown'],['cozy','☕','Cozy'],['leaf','🌿','Meadow']
 ];
 function burst(rect,emoji){
  if(!rect || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const ring=document.createElement('span');ring.className='reaction-burst';ring.setAttribute('aria-hidden','true');
  ring.style.left=(rect.left+rect.width/2)+'px';
  ring.style.top=(rect.top+rect.height/2)+'px';
  const offsets=[[-28,-34,-18],[28,-32,22],[-38,-10,-30],[38,-12,28],[-18,26,-15],[22,24,18],[0,-42,8]];
  for(const [dx,dy,rot]of offsets){
   const p=document.createElement('i');p.className='reaction-particle';p.textContent=emoji;
   p.style.setProperty('--tx',dx+'px');p.style.setProperty('--ty',dy+'px');p.style.setProperty('--rot',rot+'deg');
   ring.append(p);
  }
  document.body.append(ring);
  setTimeout(()=>ring.remove(),700);
 }
 function mount(message,data,channel,id,refresh){
  if(data.type==='system')return;
  const bar=document.createElement('div');bar.className='message-reactions';
  const uid=window.firebaseConfig.getAuth().currentUser?.uid;
  const picker=document.createElement('details');picker.className='reaction-picker';
  const summary=document.createElement('summary');summary.textContent='☺ +';summary.setAttribute('aria-label','React to message');picker.append(summary);
  const menu=document.createElement('div');menu.className='reaction-choices';menu.setAttribute('aria-label','Choose reaction');picker.append(menu);
  async function toggle(key,emoji,button){
   if(!uid || button.disabled)return;const selected=Array.isArray(data.reactions?.[key]) && data.reactions[key].includes(uid);
   const rect=button.getBoundingClientRect();
   button.disabled=true;picker.open=false;
   try{const API=window.LyriaDataAPI;await API.commit([{transform:{document:API.name('channels/'+channel+'/messages/'+id),fieldTransforms:[{fieldPath:'reactions.'+key,[selected?'removeAllFromArray':'appendMissingElements']:{values:[{stringValue:uid}]}}]},currentDocument:{exists:true}}]);if(!selected)burst(rect,emoji);refresh?.()}
   catch(error){window.LyriaUI.notify(error.code==='resource-exhausted'?error.message:'Reaction wasn’t saved. Check your connection and try again.','error')}
   finally{button.disabled=false}
  }
  for(const [key,emoji,label]of choices){
   const members=Array.isArray(data.reactions?.[key])?[...new Set(data.reactions[key].filter(v=>typeof v==='string'))]:[];
   if(members.length){const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+members.length;b.setAttribute('aria-label',label+': '+members.length+'. '+(members.includes(uid)?'Remove your reaction':'Add your reaction'));b.setAttribute('aria-pressed',String(members.includes(uid)));if(members.includes(uid))b.classList.add('super-reaction');b.onclick=()=>toggle(key,emoji,b);bar.append(b)}
   const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(members.includes(uid)));b.onclick=()=>toggle(key,emoji,b);menu.append(b);
  }
  bar.append(picker);message.append(bar);
 }
 window.LyriaReactions={mount,burst,choices};
})();
