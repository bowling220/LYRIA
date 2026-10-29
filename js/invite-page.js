(() => {
 const $=id=>document.getElementById(id),api=window.LyriaInvites;
 const code=api.parse(new URLSearchParams(location.search).get('code'));
 let user=null,db,version=0,busy=false,channelReady=false;
 function status(message){$('invite-status').textContent=message}
 function ready(label,disabled=false){$('accept-invite').textContent=label;$('accept-invite').disabled=disabled;document.querySelector('.invite-card').setAttribute('aria-busy','false')}
 async function preview(){
  const run=++version;channelReady=false;
  $('invite-title').textContent='You’re invited.';
  $('invite-description').textContent='Conversations, shared moments, and your next favorite people.';
  if(!code){status('This link is incomplete or invalid. Ask for a new invitation.');ready('Invalid invitation',true);return}
  if(!user){status('Sign in or explore as a guest to see this conversation and accept the invitation.');ready('Continue to your invitation');return}
  ready('Checking invitation…',true);document.querySelector('.invite-card').setAttribute('aria-busy','true');
  try{
   const channel=await api.lookup(db,code);if(run!==version)return;
   channelReady=true;$('invite-title').textContent=channel.name;
   $('invite-description').textContent=channel.everyone?'One shared room for the whole LYRIA community.':'A conversation is waiting. Come make yourself at home.';
   status(channel.members?.includes(user.uid)?'You’re already part of this conversation.':'Ready when you are.');ready(channel.members?.includes(user.uid)?'Open conversation':'Accept invitation');
  }catch(error){if(run!==version)return;status(api.errorMessage(error));ready(error.code==='not-found'?'Invitation unavailable':'Retry invitation',error.code==='not-found')}
 }
 $('accept-invite').addEventListener('click',async()=>{
  if(busy || !code)return;
  if(!user){location.href='login.html?invite='+encodeURIComponent(code);return}
  if(!channelReady){await preview();return}
  busy=true;const joinedAs=user.uid;ready('Joining…',true);status('Confirming your place in the conversation…');
  try{const channel=await api.join(db,user,code);if(user?.uid!==joinedAs)throw new Error('Your account changed. Please try again.');location.href=api.home(channel.id)}
  catch(error){status(api.errorMessage(error));ready('Try again')}
  finally{busy=false}
 });
 async function init(){try{await window.firebaseConfig.initialize();db=window.firebaseConfig.getFirestore();window.firebaseConfig.getAuth().onAuthStateChanged(value=>{user=value;preview()})}catch{status('LYRIA could not connect. Reload to try again.');ready('Connection unavailable',true)}}
 init();
})();
