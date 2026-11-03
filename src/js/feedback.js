/* Feedback lives on the signed-in account; no new public collection or rules are needed. */
(() => {
  const $=id=>document.getElementById(id), API=()=>window.LyriaDataAPI;
  let user=null,records=[],draft=null,busy=false,version=0;
  const key=uid=>'lyria:feedback-draft:'+uid;
  const status=(text,state)=>{$('feedback-status').textContent=text;$('feedback-status').dataset.state=state};
  function stash(){
    if(!user || busy)return;
    draft={id:typeof draft?.id==='string' && /^[a-f0-9-]{36}$/.test(draft.id)?draft.id:crypto.randomUUID(),submittedAt:typeof draft?.submittedAt==='string' && draft.submittedAt.length<40?draft.submittedAt:new Date().toISOString(),kind:$('feedback-kind').value,title:$('feedback-title').value,details:$('feedback-details').value};
    try{sessionStorage.setItem(key(user.uid),JSON.stringify(draft))}catch{}
  }
  function render(){
    const list=$('feedback-history');list.replaceChildren();
    for(const item of records.slice(-5).reverse()){
      const row=document.createElement('div');row.className='feedback-record';
      const title=document.createElement('strong');title.textContent=item.title || 'Feedback';
      const note=document.createElement('small');note.textContent=({idea:'Idea',bug:'Bug report',other:'Feedback'}[item.kind] || 'Feedback')+' · Submitted · '+String(item.id || '').slice(0,8);
      row.append(title,note);list.append(row);
    }
    if(!records.length)list.append(Object.assign(document.createElement('p'),{textContent:'Your submitted ideas and reports will appear here.'}));
  }
  async function open(){
    window.LyriaUI.openModal($('suggestions-modal'));
    const generation=++version;
    try{
      await window.firebaseConfig.initialize();const next=window.firebaseConfig.getAuth().currentUser;
      if(!next)throw Error('Sign in to send feedback.');
      user=next;records=[];draft=null;
      try{draft=JSON.parse(sessionStorage.getItem(key(user.uid)))}catch{}
      $('feedback-kind').value=['idea','bug','other'].includes(draft?.kind)?draft.kind:'idea';
      $('feedback-title').value=typeof draft?.title==='string'?draft.title.slice(0,80):'';
      $('feedback-details').value=typeof draft?.details==='string'?draft.details.slice(0,1500):'';
      status('Loading your submissions…','pending');$('feedback-submit').disabled=true;
      const doc=await API().read('users/'+user.uid);
      if(generation!==version || next.uid!==window.firebaseConfig.getAuth().currentUser?.uid)return;
      records=Array.isArray(doc.data()?.feedbackSubmissions)?doc.data().feedbackSubmissions.filter(item=>item && typeof item==='object'):[];
      render();status('','ready');$('feedback-submit').disabled=busy;
    }catch(error){status(error.message || 'Couldn’t load feedback. Close and reopen to retry.','error')}
  }
  $('open-suggestions-modal').addEventListener('click',()=>{if(!busy)open()});
  $('feedback-form').addEventListener('input',stash);
  $('feedback-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy || !user)return;
    const title=$('feedback-title').value.trim(),details=$('feedback-details').value.trim();
    if(!title || !details || title.length>80 || details.length>1500){status('Add a summary and some details first.','error');return}
    if(records.length>=50){status('This account has reached its feedback storage limit (50 submissions).','error');return}
    stash();const record={...draft,title,details};const uid=user.uid;
    busy=true;$('feedback-submit').disabled=true;
    for(const field of ['feedback-kind','feedback-title','feedback-details'])$(field).disabled=true;
    status('Sending feedback…','saving');
    try{
      if(window.firebaseConfig.getAuth().currentUser?.uid!==uid)throw Error('Your account changed. Reopen feedback.');
      await API().commit([{transform:{document:API().name('users/'+uid),fieldTransforms:[{fieldPath:'feedbackSubmissions',appendMissingElements:{values:[{mapValue:{fields:API().fields(record)}}]}},{fieldPath:'feedbackUpdatedAt',setToServerValue:'REQUEST_TIME'}]},currentDocument:{exists:true}}]);
      // An identical retained draft retries the same record, avoiding duplicate submissions.
      records=records.filter(item=>item.id!==record.id);records.push(record);render();
      try{sessionStorage.removeItem(key(uid))}catch{}
      draft=null;$('feedback-title').value='';$('feedback-details').value='';
      status('Feedback submitted. Reference '+record.id.slice(0,8)+'. Thank you!','saved');
    }catch(error){status('Couldn’t confirm your feedback. Your draft is kept; try again.','error')}
    finally{busy=false;$('feedback-submit').disabled=false;for(const field of ['feedback-kind','feedback-title','feedback-details'])$(field).disabled=false}
  });
})();
