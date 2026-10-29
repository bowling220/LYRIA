/* Atomic per-person reactions preserve simultaneous updates from other members. */
(() => {
 const choices=[['like','👍','Like'],['heart','❤️','Love'],['laugh','😂','Laugh'],['wow','😮','Wow'],['sad','😢','Sad'],['celebrate','🎉','Celebrate'],['fire','🔥','Fire'],['eyes','👀','Watching']];
 function mount(message,data,channel,id,refresh){
  if(data.type==='system')return;
  const bar=document.createElement('div');bar.className='message-reactions';
  const uid=window.firebaseConfig.getAuth().currentUser?.uid;
  const picker=document.createElement('details');picker.className='reaction-picker';
  const summary=document.createElement('summary');summary.textContent='☺ +';summary.setAttribute('aria-label','React to message');picker.append(summary);
  const menu=document.createElement('div');menu.className='reaction-choices';menu.setAttribute('aria-label','Choose reaction');picker.append(menu);
  async function toggle(key,button){
   if(!uid || button.disabled)return;const selected=Array.isArray(data.reactions?.[key]) && data.reactions[key].includes(uid);
   button.disabled=true;picker.open=false;
   try{const API=window.LyriaDataAPI;await API.commit([{transform:{document:API.name('channels/'+channel+'/messages/'+id),fieldTransforms:[{fieldPath:'reactions.'+key,[selected?'removeAllFromArray':'appendMissingElements']:{values:[{stringValue:uid}]}}]},currentDocument:{exists:true}}]);refresh?.()}
   catch(error){window.LyriaUI.notify('Reaction wasn’t saved. Check your connection and try again.','error')}
   finally{button.disabled=false}
  }
  for(const [key,emoji,label]of choices){
   const members=Array.isArray(data.reactions?.[key])?[...new Set(data.reactions[key].filter(v=>typeof v==='string'))]:[];
   if(members.length){const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+members.length;b.setAttribute('aria-label',label+': '+members.length+'. '+(members.includes(uid)?'Remove your reaction':'Add your reaction'));b.setAttribute('aria-pressed',String(members.includes(uid)));b.onclick=()=>toggle(key,b);bar.append(b)}
   const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(members.includes(uid)));b.onclick=()=>toggle(key,b);menu.append(b);
  }
  bar.append(picker);message.append(bar);
 }
 window.LyriaReactions={mount};
})();
