/* Choose people from this conversation's recent participants; no global-user enumeration. */
(() => {
 const input=document.getElementById('message-input'),list=document.getElementById('mention-suggestions');let people=[],chosen=new Map(),matches=[],highlight=0;
 const hide=()=>{list.hidden=true;input.setAttribute('aria-expanded','false')};
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function setPeople(messages){const map=new Map();for(const message of messages)if(typeof message.senderId==='string' && typeof message.sender==='string' && message.senderId!==window.firebaseConfig.getAuth()?.currentUser?.uid)map.set(message.senderId,{id:message.senderId,name:message.sender.slice(0,80)});people=[...map.values()].slice(-50);chosen.clear();hide()}
 function choose(person){const end=input.selectionStart,before=input.value.slice(0,end),match=before.match(/(^|\s)@([^@\n]{0,80})$/);if(!match)return;const start=end-match[2].length-1;if(input.value.length-(end-start)+person.name.length+2>input.maxLength){window.LyriaUI.notify('That mention would exceed the message limit.');return}input.setRangeText('@'+person.name+' ',start,end,'end');chosen.set(person.name,person.id);hide();input.focus();input.dispatchEvent(new Event('input',{bubbles:true}))}
 function render(){
  const before=input.value.slice(0,input.selectionStart),match=before.match(/(^|\s)@([^@\n]{0,80})$/);if(!match){hide();return}
  matches=people.filter(p=>p.name.toLowerCase().includes(match[2].toLowerCase())).slice(0,8);list.replaceChildren();highlight=0;
  if(!matches.length){hide();return}for(const [index,person]of matches.entries()){const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===highlight));button.textContent=person.name;button.addEventListener('click',()=>choose(person));list.append(button)}list.hidden=false;input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','true');
 }
 input.addEventListener('input',render);input.addEventListener('keydown',event=>{if(list.hidden)return;if(['ArrowDown','ArrowUp','Enter','Escape'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape'){hide();return}if(event.key==='Enter'){choose(matches[highlight]);return}highlight=(highlight+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;[...list.children].forEach((b,index)=>b.setAttribute('aria-selected',String(index===highlight)))}});
 document.addEventListener('pointerdown',event=>{if(!list.contains(event.target) && event.target!==input)hide()});
 function ids(text){const result=[];for(const person of people){if(new RegExp('(^|\\s)@'+escape(person.name)+'(?=\\s|$|[.,!?])','iu').test(text) && (chosen.get(person.name)===person.id || (!chosen.has(person.name) && people.filter(p=>p.name===person.name).length===1)))result.push(person.id)}return [...new Set(result)].slice(0,20)}
 window.LyriaMentions={setPeople,ids};
})();
