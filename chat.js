// Use the configured Firebase instances from config.js
let auth, db;
const COMMUNITY_CHANNEL_ID = 'community';

// Wait for Firebase to be initialized
const initializeFirebase = async () => {
    if (window.firebaseConfig) {
        try {
            await window.firebaseConfig.initialize();
            auth = window.firebaseConfig.getAuth();
            db = window.firebaseConfig.getFirestore();
            // Expose globally for inline scripts that expect these
            window.auth = auth;
            window.db = db;
            console.log('Firebase initialized for chat module');
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            if (window.utils) {
                window.utils.showError('Failed to connect to chat service. Please refresh the page.');
            }
        }
    } else {
        console.error('Firebase config not found');
    }
};

let currentUser;
let currentChannel;
let hubChannels=[];
const channelNames=new Map([[COMMUNITY_CHANNEL_ID,'Everyone']]);
let channelSelectionVersion=0;

function rememberChannelName(id,name){
    if(typeof name==='string' && name.trim())channelNames.set(id,name.trim());
    if(currentChannel===id)renderChannelIdentity(id);
}
function renderChannelIdentity(id){
    if(currentChannel!==id)return;
    const name=channelNames.get(id) || (id===`personal-${currentUser?.uid}`?'My personal channel':'Conversation');
    const heading=document.getElementById('channel-title');heading.textContent=name;heading.dataset.selectedChannelId=id;
    document.querySelector('.chat-area').dataset.selectedChannelId=id;
    document.getElementById('message-input').placeholder=id===COMMUNITY_CHANNEL_ID?'Message everyone…':'Message #'+name;
    window.setupCallListeners?.(id,name);
    window.LyriaShell?.select(id,name,currentUser,hubChannels);
}
let lastMessageTimestamp = null;
let unsubscribeFromMessages = null;
let unsubscribeTyping = null; // Unsubscribe function for message listener
let uiListenersAttached = false;
let channelLoadVersion = 0;
let messageLoadVersion = 0;
let communityAccessDenied = false;
let usedCommunityFallback = false;

// Create notification sound
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Mobile menu toggle functionality
function setMobileMenuOpen(isOpen) {
    const headerToggle = document.querySelector('#header-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (!headerToggle || !sidebar) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const shouldOpen = isMobile && isOpen;
    sidebar.classList.toggle('open', shouldOpen);
    headerToggle.setAttribute('aria-expanded', shouldOpen.toString());
    headerToggle.setAttribute('aria-label', shouldOpen ? 'Close community menu' : 'Open community menu');
    const hubVisible=isMobile && document.querySelector('.chat-area')?.dataset.view==='hub';
    sidebar.setAttribute('aria-hidden', (isMobile && !shouldOpen && !hubVisible).toString());
    sidebar.toggleAttribute('inert', isMobile && !shouldOpen && !hubVisible);

}

function setupMobileMenu() {
    const headerToggle = document.querySelector('#header-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const closeButton = document.getElementById('close-mobile-menu');

    if (!headerToggle || !sidebar) return;

    headerToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = !sidebar.classList.contains('open');
        setMobileMenuOpen(willOpen);
        if (willOpen && event.detail === 0) closeButton?.focus();
    });

    closeButton?.addEventListener('click', () => {
        setMobileMenuOpen(false);
        headerToggle.focus();
    });

    document.getElementById('open-friends-modal')?.addEventListener('click', () => setMobileMenuOpen(false));
    document.getElementById('open-suggestions-modal')?.addEventListener('click', () => setMobileMenuOpen(false));
    document.getElementById('settings-btn')?.addEventListener('click', () => setMobileMenuOpen(false));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            setMobileMenuOpen(false);
            headerToggle.focus();
        }
    });

    // Keyboard and browser toolbar resizes should not dismiss the drawer.
    window.matchMedia('(max-width: 768px)').addEventListener('change', () => setMobileMenuOpen(false));
    setMobileMenuOpen(false);
}

// Call setup after DOM loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileMenu);
} else {
    setupMobileMenu();
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const headerToggle = document.querySelector('#header-menu-toggle');

    if (!sidebar || !headerToggle) return;

    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        !headerToggle.contains(e.target) &&
        sidebar.classList.contains('open')) {
        setMobileMenuOpen(false);
    }
});

// Initialize Firebase and setup authentication
initializeFirebase().then(() => {
    if (!auth) {
        window.LyriaConnection?.fail('startup','LYRIA couldn’t start. Reload to try again.');
        console.error('Auth not initialized');
        return;
    }

    // Make every control responsive immediately; data-dependent actions already
    // guard currentUser/currentChannel until authentication finishes.
    setupUIEventListeners();
    window.LyriaConnection?.setRetry(async()=>{
        if(!currentUser){location.reload();return;}
        window.LyriaConnection.ready('recovery');
        await db.disableNetwork();await db.enableNetwork();
        if(currentChannel)loadMessages(currentChannel);else restoreConversation(currentUser);loadChannels();
        if(currentChannel)listenForTypingStatus(currentChannel);
        window.LyriaVoice?.refreshConnection?.();
        if(currentUser)window.LyriaReadState?.init(currentUser).then(()=>window.LyriaReadState.refresh(true));
        window.LyriaCommunity?.refreshRequests();
        window.LyriaCalls?.refresh();
        window.LyriaAccount?.reconnect({restartLive:false});
    });

function renderHub(){
    const list=document.getElementById('hub-conversations');
    const search=document.getElementById('hub-search').value.trim().toLowerCase();
    list.replaceChildren();
    const rooms=[{id:COMMUNITY_CHANNEL_ID,name:'Everyone',shared:true},...hubChannels].filter(room=>window.LyriaSearch.matches(room.name || 'Conversation',search));
    for(const room of rooms){
        const button=document.createElement('button');button.type='button';button.className='hub-conversation';
        const mark=document.createElement('span');mark.className='hub-room-icon';mark.innerHTML=window.LyriaUI.icon(room.shared?'users':'hash');
        const text=document.createElement('span');const title=document.createElement('strong');title.textContent=room.name || 'Conversation';
        const detail=document.createElement('span');detail.textContent=room.shared?'The whole community, together':room.id===`personal-${currentUser?.uid}`?'Notes, ideas, and a little space for you':room.favorite?'One of your favorites':'Your shared space to catch up';
        text.className='hub-room-copy';text.append(title,detail);button.append(mark,text);
        const end=document.createElement('span');end.className='hub-room-end';
        if(room.shared){end.textContent='COMMUNITY';end.classList.add('hub-community-tag')}
        else end.innerHTML=window.LyriaUI.icon(room.favorite?'star':'arrow');
        end.setAttribute('aria-hidden','true');button.append(end);button.addEventListener('click',()=>switchChannel(room.id,room.name));list.append(button);
    }
    window.LyriaShell?.rooms(hubChannels,currentUser);
    if(!rooms.length){const empty=document.createElement('p');empty.textContent='No conversations match your search.';list.append(empty)}
}
function showHub(historyMode='push'){
    saveMessageDraft();
    ++channelSelectionVersion;
    window.LyriaConnection?.ready('messages');
    if(currentChannel)setTypingStatus(false);
    unsubscribeFromMessages?.();unsubscribeFromMessages=null;
    unsubscribeTyping?.();unsubscribeTyping=null;
    currentChannel=null;window.LyriaReadState?.setActive(null);window.LyriaMentions?.setPeople([]);
    const area=document.querySelector('.chat-area');area.dataset.view='hub';delete area.dataset.selectedChannelId;
    document.getElementById('conversation-hub').hidden=false;
    document.getElementById('leave-channel').disabled=true;
    document.getElementById('make-voice-call').disabled=true;
    document.querySelectorAll('.channel-btn').forEach(button=>{button.classList.remove('active-channel');button.setAttribute('aria-current','false')});
    document.getElementById('open-hub').setAttribute('aria-current','page');
    window.LyriaVoiceView?.showChat();window.LyriaVoice?.setRoom(null);
    try{const url=new URL(location.href);url.searchParams.delete('channel');url.searchParams.set('view','hub');if(url.href!==location.href)history[historyMode+'State'](null,'',url)}catch{}
    setMobileMenuOpen(false);renderHub();window.LyriaShell?.hub();
}
document.getElementById('open-hub').addEventListener('click',()=>showHub());
document.getElementById('back-to-hub').addEventListener('click',()=>showHub());
document.getElementById('hub-search').addEventListener('input',renderHub);
document.getElementById('hub-friends').addEventListener('click',()=>window.LyriaCommunity?.openFriends());
document.getElementById('hub-create').addEventListener('click',()=>document.getElementById('add-channel').click());
document.getElementById('hub-join').addEventListener('click',()=>document.getElementById('join-channel').click());
window.addEventListener('popstate',()=>{if(currentUser){++channelSelectionVersion;restoreConversation(currentUser)}});

function restoreConversation(user){
    const version=channelSelectionVersion;
    let saved=null;try{saved=JSON.parse(localStorage.getItem('lyria:last-conversation:'+user.uid))}catch{}
    const requested=new URLSearchParams(location.search).get('channel');
    const id=requested;
    if(!id){showHub('replace');return}
    if(id===COMMUNITY_CHANNEL_ID || !/^[A-Za-z0-9_-]{1,180}$/.test(id)){if(id===COMMUNITY_CHANNEL_ID)switchChannel(id,undefined,'replace');else showHub('replace');return}
    document.getElementById('channel-title').textContent=saved?.id===id && typeof saved.name==='string'?saved.name:'Opening conversation…';
    document.getElementById('message-input').placeholder='Opening your conversation…';
    document.getElementById('make-voice-call').disabled=true;
    window.LyriaConnection?.pending('messages');
    return window.LyriaDataAPI.read('channels/'+id).then(doc=>{
        if(currentUser?.uid!==user.uid || channelSelectionVersion!==version)return;
        if(doc.exists && Array.isArray(doc.data().members) && doc.data().members.includes(user.uid))switchChannel(doc.id,doc.data().name,'replace');
        else {showHub('replace');window.LyriaUI.notify('That conversation is no longer available to your account.','error')}
    }).catch(error=>{
        if(currentUser?.uid!==user.uid || channelSelectionVersion!==version)return;
        if(error.code==='permission-denied' || error.code==='not-found')showHub('replace');
        else window.LyriaConnection?.fail('messages','Your last conversation couldn’t reopen. Try reconnecting.');
    });
}


    // Use one authentication path for user setup, channel setup and UI listeners.
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            pendingMessageSends.clear();
            window.LyriaUI.stopPanelRestoration();
            window.location.href = 'login.html';
            return;
        }

        if (currentUser?.uid !== user.uid) pendingMessageSends.clear();
        currentUser = user;
        window.LyriaConnection?.ready('startup');
        window.LyriaConnection?.pending('messages');
        const viewRevision=window.LyriaUI.panelRevision();
        const selectionReady=Promise.resolve(window.LyriaReadState.init(user)).then(()=>{if(currentUser?.uid===user.uid && !currentChannel)return restoreConversation(user)});
        // Wait for page listeners and room validation; restoration never submits an action.
        const restoreViews=()=>Promise.resolve(selectionReady).then(()=>{
            if(currentUser?.uid!==user.uid)return;
            const click=id=>document.getElementById(id)?.click();
            return window.LyriaUI.restorePanels(user,{
                'conversation-details-dialog':{capture:()=>({id:currentChannel}),open:data=>{if(data.id && data.id===currentChannel)click('conversation-details-toggle')}},
                'composer-tools-modal':{capture:()=>({id:currentChannel}),open:data=>{if(data.id && data.id===currentChannel)click('composer-tools')}},
                'settings-modal':{open:()=>click('settings-btn')},
                'friends-modal':{open:()=>window.LyriaCommunity.openFriends()},
                'profile-modal':{capture:modal=>({uid:modal.dataset.userId}),open:(data,canOpen)=>typeof data.uid==='string' && data.uid.length<=128?showUserProfileModal(data.uid,{canOpen}):undefined},
                'suggestions-modal':{open:()=>click('open-suggestions-modal')},
                'channel-action-modal':{capture:modal=>({mode:modal.dataset.mode,value:document.getElementById('channel-action-input').value}),open:data=>{
                    const trigger={create:'add-channel',join:'join-channel',leave:'leave-channel'}[data.mode];if(!trigger || (data.mode==='leave' && !currentChannel))return;
                    click(trigger);const input=document.getElementById('channel-action-input');if(typeof data.value==='string')input.value=data.value.slice(0,input.maxLength);
                }},
                'share-invite-modal':{capture:()=>({link:document.getElementById('share-invite-link').value,id:document.getElementById('share-invite-modal').dataset.channelId}),open:async data=>{
                    if(typeof data.id!=='string' || data.id!==currentChannel)return;const invitation=await window.LyriaInvites.current(db,user,data.id);
                    const modal=document.getElementById('share-invite-modal');modal.dataset.channelId=data.id;document.getElementById('share-invite-link').value=invitation.link;document.getElementById('invite-owner-controls').hidden=!invitation.owner;window.LyriaUI.openModal(modal);
                }},
                'gif-modal':{capture:()=>window.LyriaGifPicker.capture(),open:data=>window.LyriaGifPicker.restore(data)}
            },viewRevision);
        });
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(restoreViews,0),{once:true});else setTimeout(restoreViews,0);
        loadChannels();
        try {
            await window.LyriaAccount.ensureUser(user);
            const personalChannelId = `personal-${user.uid}`;
            const ref = db.collection('channels').doc(personalChannelId);
            const doc = await ref.get();
            if (!doc.exists) {
                await ref.set({name:'My personal channel',id:personalChannelId,createdBy:user.uid,members:[user.uid],isPublic:false});
            } else if (!(doc.data().members || []).includes(user.uid)) {
                await ref.update({members:firebase.firestore.FieldValue.arrayUnion(user.uid)});
            }
            loadChannels();
            if (communityAccessDenied && currentChannel === COMMUNITY_CHANNEL_ID) switchChannel(personalChannelId);
        } catch (error) {
            console.error('Account or personal workspace could not initialize:', error);
            window.LyriaUI.notify('Your personal workspace could not load. '+window.LyriaAccount.errorMessage(error),'error');
        }
    });

function setupUIEventListeners() {
    if (uiListenersAttached) return;
    uiListenersAttached = true;
    const profileModal = document.getElementById('profile-modal');
    const profileCloseButton = document.getElementById('close-profile-modal');
    profileCloseButton.classList.add('profile-close');
    profileCloseButton.type = 'button';
    profileCloseButton.setAttribute('aria-label', 'Close profile');
    profileCloseButton.innerHTML = window.LyriaUI.icon('close');

    const closeProfileModal = () => {
        profileModal.style.display = 'none';
        profileModal.setAttribute('aria-hidden', 'true');
        profileModal.setAttribute('inert', '');
    };

    profileCloseButton.addEventListener('click', closeProfileModal);
    profileModal.addEventListener('click', event => {
        if (event.target === profileModal) closeProfileModal();
    });
    profileModal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();closeProfileModal();}
    });

    // Logout button event listener
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Send message
    document.getElementById('send-button').addEventListener('click', () => {
        const messageInput = document.getElementById('message-input');
        const messageText = messageInput.value; // Get the value from the textarea
        sendMessage(messageText); // Call sendMessage with the input value
    });

    document.getElementById('message-input').addEventListener('keydown', (e) => {
        // Touch keyboards use Return for newlines; Send remains explicit.
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing &&
            !window.matchMedia('(pointer: coarse)').matches) {
            e.preventDefault();
            const messageText = messageInput.value; // Get the value from the textarea
            sendMessage(messageText); // Call sendMessage with the input value
        }
    });

    // Detect typing
    const messageInput = document.getElementById('message-input');
    let typingTimer;
    const TYPING_INTERVAL = 3000; // 3 seconds of inactivity considered as stopped typing

    messageInput.addEventListener('input', () => {
        saveMessageDraft();
        messageInput.style.height = '48px';
        messageInput.style.height = Math.min(messageInput.scrollHeight, window.innerWidth <= 768 ? 100 : 150) + 'px';
        setTypingStatus(true);

        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            setTypingStatus(false);
        }, TYPING_INTERVAL);
    });

    messageInput.addEventListener('blur', () => {
        setTypingStatus(false);
    });

    // Use an in-page sheet for channel actions so every control works reliably on mobile.
    const channelActionModal = document.getElementById('channel-action-modal');
    const channelActionTitle = document.getElementById('channel-action-title');
    const channelActionDescription = document.getElementById('channel-action-description');
    const channelActionField = document.getElementById('channel-action-field');
    const channelActionLabel = document.getElementById('channel-action-label');
    const channelActionInput = document.getElementById('channel-action-input');
    const channelActionFeedback = document.getElementById('channel-action-feedback');
    const channelActionSubmit = document.getElementById('submit-channel-action');
    let isSubmittingChannelAction = false;

    const closeChannelActionModal = () => {
        channelActionModal.style.display = 'none';
        channelActionModal.setAttribute('aria-hidden', 'true');
        channelActionModal.setAttribute('inert', '');
        channelActionInput.value = '';
        channelActionFeedback.textContent = '';
    };

    const openChannelActionModal = (mode) => {
        const isLeave = mode === 'leave';
        channelActionModal.dataset.mode = mode;
        channelActionTitle.textContent = mode === 'create' ? 'Start a conversation' : mode === 'join' ? 'Join a conversation' : 'Leave this conversation?';
        channelActionDescription.textContent = mode === 'create'
            ? 'Give your new conversation a short, memorable name.'
            : mode === 'join'
                ? 'Paste the invite link or code shared by a LYRIA member.'
                : 'You will need a new invite code to return later.';
        channelActionField.hidden = isLeave;
        channelActionLabel.textContent = mode === 'create' ? 'Conversation name' : 'Invite link or code';
        channelActionInput.placeholder = mode === 'create' ? 'e.g. Design club' : 'Paste invite link or code';
        channelActionInput.maxLength = mode === 'create' ? 48 : 2048;
        channelActionSubmit.textContent = mode === 'create' ? 'Create' : mode === 'join' ? 'Join' : 'Leave';
        channelActionSubmit.classList.toggle('danger-action', isLeave);
        channelActionFeedback.textContent = '';
        channelActionModal.removeAttribute('inert');
        channelActionModal.setAttribute('aria-hidden', 'false');
        channelActionModal.style.display = 'flex';
        setMobileMenuOpen(false);
        (isLeave ? channelActionSubmit : channelActionInput).focus();
    };

    window.LyriaReadState.setNavigation({first:()=>currentChannel && loadMessages(currentChannel,{unreadOnly:true}),latest:()=>currentChannel && loadMessages(currentChannel)});
    document.getElementById('add-channel').addEventListener('click', () => openChannelActionModal('create'));
    document.getElementById('join-channel').addEventListener('click', () => openChannelActionModal('join'));
    document.getElementById('leave-channel').addEventListener('click', () => openChannelActionModal('leave'));
    document.getElementById('close-channel-action-modal').addEventListener('click', closeChannelActionModal);
    document.getElementById('cancel-channel-action').addEventListener('click', closeChannelActionModal);
    channelActionModal.addEventListener('click', event => {
        if (event.target === channelActionModal) closeChannelActionModal();
    });
    channelActionModal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeChannelActionModal();
        if (event.key === 'Enter' && event.target === channelActionInput) channelActionSubmit.click();
    });

    channelActionSubmit.addEventListener('click', async () => {
        if (isSubmittingChannelAction) return;
        const mode = channelActionModal.dataset.mode;
        const value = channelActionInput.value.trim();
        if (mode !== 'leave' && !value) {
            channelActionFeedback.textContent = mode === 'create' ? 'Enter a conversation name.' : 'Enter an invite code.';
            channelActionInput.focus();
            return;
        }

        isSubmittingChannelAction = true;
        channelActionSubmit.disabled = true;
        channelActionFeedback.textContent = mode === 'create' ? 'Creating…' : mode === 'join' ? 'Joining…' : 'Leaving…';

        try {
            if (mode === 'create') {
                const channelId = `${Date.now()}-${currentUser.uid}`;
                const channelRef = db.collection('channels').doc(channelId);
                const save = async (batch,legacy) => {
                batch.set(channelRef, {
                    name: value,
                    id: channelId,
                    createdBy: currentUser.uid,
                    members: [currentUser.uid],
                    isPublic: false,
                    favorite: false
                });
                batch.set(userDocRefForCurrentUser(), {
                    channels: firebase.firestore.FieldValue.arrayUnion(channelId)
                }, { merge: true });
                if(legacy)await batch.commit();
                };
                await window.LyriaWriteLimits.run('channels',channelId,save);

                switchChannel(channelId,value);
                loadChannels();
                closeChannelActionModal();

                // A welcome message is helpful but should never make channel creation appear to fail.
                window.LyriaDataAPI.commit([{update:{name:window.LyriaDataAPI.name('channels/'+channelId+'/messages/'+crypto.randomUUID()),fields:window.LyriaDataAPI.fields({message:`Welcome to ${value}, ${currentUser.displayName || 'User'}!`,sender:'System',senderId:currentUser.uid,type:'system'})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]).catch(error=>console.warn('Welcome message could not be posted:',error));
            } else if (mode === 'join') {
                const channel = await window.LyriaInvites.join(db,currentUser,value);
                const channelId = channel.id;
                switchChannel(channelId,channel.name);
                loadChannels();
                closeChannelActionModal();
            } else {
                const personalChannelId = `personal-${currentUser.uid}`;
                if (!currentChannel || currentChannel === personalChannelId || currentChannel === COMMUNITY_CHANNEL_ID) return;
                const leavingChannelId = currentChannel;
                window.LyriaVoice?.leaveRoom(leavingChannelId);
                const channelRef = db.collection('channels').doc(leavingChannelId);
                await Promise.all([
                    channelRef.update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) }),
                    userDocRefForCurrentUser().set({
                        channels: firebase.firestore.FieldValue.arrayRemove(leavingChannelId),
                        favoriteChannels: firebase.firestore.FieldValue.arrayRemove(leavingChannelId)
                    }, { merge: true })
                ]);
                showHub();
                loadChannels();
                closeChannelActionModal();
            }
        } catch (error) {
            console.error(`Channel ${mode} failed:`, error);
            channelActionFeedback.textContent = error.code === 'resource-exhausted' ? error.message : error.code === 'permission-denied'
                ? 'LYRIA could not save that change. Please sign out, sign back in, and try once more.'
                : 'That action could not be completed. Please try again.';
        } finally {
            isSubmittingChannelAction = false;
            channelActionSubmit.disabled = false;
        }
    });

    document.getElementById('copy-invite-link').addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(document.getElementById('share-invite-link').value);window.LyriaUI.notify('Invite link copied.','success')}
        catch{document.getElementById('share-invite-link').focus();document.getElementById('share-invite-link').select()}
    });
    for(const action of ['replace','revoke'])document.getElementById(action+'-invite').addEventListener('click',async event=>{
        const id=document.getElementById('share-invite-modal').dataset.channelId;if(!id)return;
        const button=event.currentTarget;button.disabled=true;const status=document.getElementById('invite-control-status');status.textContent='Confirming invitation change…';
        try{
            if(action==='replace'){
                const result=await window.LyriaInvites.replace(db,currentUser,id,Number(document.getElementById('invite-expiry').value));
                document.getElementById('share-invite-link').value=result.link;status.textContent='New link ready. The previous link no longer accepts joins.';
            }else{await window.LyriaInvites.revoke(db,currentUser,id);document.getElementById('share-invite-link').value='';status.textContent='Invitation revoked. Existing members keep their access.'}
        }catch(error){status.textContent=window.LyriaInvites.errorMessage(error)}finally{button.disabled=false}
    });
    document.getElementById('copy-join-code').addEventListener('click', async () => {
        if (!currentChannel || !db) return;
        try {
            const selected=currentChannel;
            const invitation=await window.LyriaInvites.current(db,currentUser,selected);
            const link=invitation.link;
            const share=document.getElementById('share-invite-modal');share.dataset.channelId=selected;
            document.getElementById('share-invite-link').value=link;
            document.getElementById('invite-owner-controls').hidden=!invitation.owner;
            document.getElementById('invite-control-status').textContent=invitation.expiresAt?'Expires '+new Date(invitation.expiresAt.toMillis?.() || invitation.expiresAt).toLocaleString():'This link stays active until the owner revokes it.';
            if(invitation.owner)window.LyriaUI.openModal(share);
            try {
                await navigator.clipboard.writeText(link);
                window.LyriaUI.notify('Invite link copied. Share it with your people.', 'success');
            } catch {
                const input=document.getElementById('share-invite-link');input.value=link;
                window.LyriaUI.openModal(document.getElementById('share-invite-modal'));
                requestAnimationFrame(()=>requestAnimationFrame(()=>{input.focus();input.select()}));
            }
        } catch (error) {
            console.error(error); window.LyriaUI.notify('Could not load the invitation. Please try again.', 'error');
        }
    });
}

function userDocRefForCurrentUser() {
    return db.collection('users').doc(currentUser.uid);
}

// Drafts are private to this browser tab, account, and conversation.
let exitingAccount=false;
function draftKey(){return currentUser && currentChannel?'lyria:message-draft:'+currentUser.uid+':'+currentChannel:null}
function saveMessageDraft(){if(exitingAccount)return;const key=draftKey();if(!key)return;try{const text=document.getElementById('message-input').value;if(text)sessionStorage.setItem(key,text.slice(0,4000));else sessionStorage.removeItem(key)}catch{}}
function restoreMessageDraft(){const input=document.getElementById('message-input');try{input.value=sessionStorage.getItem(draftKey()) || ''}catch{input.value=''}input.style.height='';document.getElementById('message-send-status').textContent=''}
window.addEventListener('pagehide',saveMessageDraft);
let isSendingMessage = false;
const pendingMessageSends = new Map();
async function sendMessage(messageText, isCode = false) {
    if (isSendingMessage || typeof messageText !== 'string' || !messageText.trim()) return;
    if (!currentUser || !currentChannel || !db) { window.LyriaUI.notify('Wait for your conversation to finish loading.'); return; }
    if (messageText.length > 4000) { window.LyriaUI.notify('Keep messages under 4,000 characters.'); return; }
    const input = document.getElementById('message-input');
    const button = document.getElementById('send-button');
    const channelId = currentChannel;
    const draft = input.value;
    const pendingKey = JSON.stringify([currentUser.uid, channelId]);
    let pending = pendingMessageSends.get(pendingKey);
    const retryKey='lyria:message-retry:'+currentUser.uid+':'+channelId;
    if(!pending)try{const saved=JSON.parse(sessionStorage.getItem(retryKey));const write=saved?.writes?.[0];if(saved?.writes?.length===1 && saved.message===messageText.trim() && write?.update?.fields?.senderId?.stringValue===currentUser.uid && write.update.name.startsWith(window.LyriaDataAPI.name('channels/'+channelId+'/messages/')))pending=saved}catch{}
    if (!pending || pending.message !== messageText.trim()) {
        pending = {message: messageText.trim(), writes: [{update:{name:window.LyriaDataAPI.name('channels/'+channelId+'/messages/'+crypto.randomUUID()),fields:window.LyriaDataAPI.fields({
            message: messageText.trim(),
            sender: document.getElementById('user-name').textContent || currentUser.displayName || 'LYRIA member',
            senderId: currentUser.uid,
            mentions: window.LyriaMentions.ids(messageText),
            senderPhotoURL: window.LyriaMedia.messageAvatar(document.getElementById('user-avatar').src)
        })},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]};
    }
    pendingMessageSends.set(pendingKey,pending);
    try{sessionStorage.setItem(retryKey,JSON.stringify(pending))}catch{}
    document.getElementById('message-send-status').textContent='Sending…';
    isSendingMessage = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {
        await window.LyriaDataAPI.commit(pending.writes);
        if (pendingMessageSends.get(pendingKey) === pending) pendingMessageSends.delete(pendingKey);
        try{sessionStorage.removeItem(retryKey)}catch{}
        if(currentChannel===channelId)unsubscribeFromMessages?.refresh?.();
        if (input.value === draft && currentChannel === channelId) { input.value = ''; input.style.height = ''; }
        saveMessageDraft();
        document.getElementById('message-send-status').textContent=currentChannel===channelId?'Sent.':'';
        setTypingStatus(false);
    } catch (error) {
        saveMessageDraft();document.getElementById('message-send-status').textContent='Not confirmed. Your draft is kept; retry when connected.';
        console.error(error); window.LyriaUI.notify(error.code==='resource-exhausted'?error.message:'Couldn’t confirm the message. Your draft is still here; reconnect before trying again.', 'error');
    } finally {
        isSendingMessage = false; button.disabled = false; button.removeAttribute('aria-busy');
    }
}

window.sendLibraryGif = async function sendLibraryGif(id) {
    if (!currentUser || !currentChannel) throw new Error('Wait for your conversation to finish loading.');
    const gif = window.LyriaGifLibrary.metadata(id);
    const channel = currentChannel;
    const user = currentUser;
    const profile = window.LyriaAccount.getProfile();
    const key=JSON.stringify(['gif',user.uid,channel,id]),storageKey='lyria:message-retry:'+user.uid+':'+channel+':gif';
    let pending=pendingMessageSends.get(key);
    if(!pending)try{const saved=JSON.parse(sessionStorage.getItem(storageKey)),write=saved?.writes?.[0];if(saved?.gifId===id && saved.writes.length===1 && write?.update?.fields?.senderId?.stringValue===user.uid && write.update.name.startsWith(window.LyriaDataAPI.name('channels/'+channel+'/messages/')))pending=saved}catch{}
    if(!pending)pending={gifId:id,writes:[{update:{name:window.LyriaDataAPI.name('channels/'+channel+'/messages/'+crypto.randomUUID()),fields:window.LyriaDataAPI.fields({
        message: gif.url,
        content: gif.url,
        type: 'gif',
        gif,
        sender: profile.displayName || user.displayName || 'LYRIA member',
        senderId: user.uid,
        senderPhotoURL: window.LyriaMedia.messageAvatar(profile.photoURL || user.photoURL),
    })},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]};
    pendingMessageSends.set(key,pending);try{sessionStorage.setItem(storageKey,JSON.stringify(pending))}catch{}
    const status=document.getElementById('message-send-status');status.textContent='Sending GIF…';
    try{await window.LyriaDataAPI.commit(pending.writes);pendingMessageSends.delete(key);try{sessionStorage.removeItem(storageKey)}catch{};if(currentChannel===channel){unsubscribeFromMessages?.refresh?.();status.textContent='Sent.'}}
    catch(error){if(currentChannel===channel)status.textContent='GIF not confirmed. Retry your selection when connected.';throw error}
};

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let typingSent = {key:null,on:false,at:0};
function setTypingStatus(isTyping) {
    if (currentChannel && currentUser) {
        const key=JSON.stringify([currentUser.uid,currentChannel]),now=Date.now();
        if(isTyping && typingSent.key===key && typingSent.on && now-typingSent.at<3000)return;
        if(!isTyping && (typingSent.key!==key || !typingSent.on))return;
        typingSent={key,on:isTyping,at:now};
        const typingRef = db.collection('channels').doc(currentChannel)
            .collection('typingStatus').doc(currentUser.uid);

        if (isTyping) {
            typingRef.set({
                displayName: document.getElementById('user-name').textContent || 'LYRIA member',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                isTyping: true
            },{merge:true}).catch(error => {
                console.error("Error setting typing status:", error);
            });
        } else {
            typingRef.set({isTyping:false},{merge:true}).catch(error => {
                console.error("Error deleting typing status:", error);
            });
        }
    }
}

function listenForTypingStatus(channelId) {
    unsubscribeTyping?.();
    const typingStatusContainer = document.getElementById('typing-status');
    if (!typingStatusContainer) {
        console.error("Typing status container not found in HTML.");
        return;
    }

    const typingRef = db.collection('channels').doc(channelId)
        .collection('typingStatus');

    unsubscribeTyping = typingRef.onSnapshot(snapshot => {
        if (currentChannel !== channelId) return;
        const typingUsers = [];
        snapshot.forEach(doc => {
            const updated = doc.data().timestamp?.toDate?.();
            const typing = doc.data().isTyping === true || (doc.data().isTyping === undefined && Boolean(updated));
            if (typing && doc.id !== currentUser.uid && (!updated || Date.now() - updated.getTime() < 15000)) {
                typingUsers.push(doc.data().displayName || 'Someone');
            }
        });

        if (typingUsers.length > 0) {
            typingStatusContainer.textContent = `${typingUsers.join(', ')} is typing...`;
            typingStatusContainer.style.display = 'block';
        } else {
            typingStatusContainer.style.display = 'none';
        }
    }, error => {
        console.error("Error listening for typing status:", error);
    });
}

function loadChannels() {
    window.LyriaConnection?.pending('channels');
    const version = ++channelLoadVersion;
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '<li class="community-channel"><button type="button" class="channel-btn" data-channel-id="community">'+window.LyriaUI.icon('users')+'<span class="channel-name">Everyone</span><span class="room-label">SHARED</span></button><p class="community-note">One room for the whole community.</p></li>';
    const everyone = channelsList.querySelector('[data-channel-id="community"]');
    everyone.classList.toggle('active-channel', currentChannel === COMMUNITY_CHANNEL_ID);
    everyone.setAttribute('aria-current', String(currentChannel === COMMUNITY_CHANNEL_ID));
    everyone.addEventListener('click',()=>{switchChannel(COMMUNITY_CHANNEL_ID);setMobileMenuOpen(false)});

    // Get channels where user is a member
    window.LyriaDataAPI.query('channels',{where:window.LyriaDataAPI.equal('members',currentUser.uid,'ARRAY_CONTAINS')})
        .then(async snapshot => {
            // Preferences are optional: a stalled profile stream must not hide conversations.
            let timer;
            const userDoc=await Promise.race([
                window.LyriaDataAPI.read('users/'+currentUser.uid).catch(()=>null),
                new Promise(resolve=>{timer=setTimeout(()=>resolve(null),3000)})
            ]).finally(()=>clearTimeout(timer));
                if (version !== channelLoadVersion) return;
                window.LyriaConnection?.ready('channels');
                const userData = userDoc?.data() || window.LyriaAccount?.getProfile() || {};
                const favoriteChannels = userData.favoriteChannels || []; // Get user's favorite channels

                const channels = snapshot.docs.filter(doc=>doc.id !== COMMUNITY_CHANNEL_ID).map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    favorite: favoriteChannels.includes(doc.id) // Set favorite based on user's favorites
                }));

                // Sort channels: favorites first
                channels.sort((a, b) => (b.favorite === a.favorite) ? 0 : (b.favorite ? 1 : -1));

                hubChannels=channels;renderHub();
                channels.forEach(channel => {
                    rememberChannelName(channel.id,channel.name);
                    const channelElement = document.createElement('li');
                    const channelContainer = document.createElement('div');
                    channelContainer.className = 'channel-container';

                    const button = document.createElement('button');
                    button.className = 'channel-btn';
                    button.innerHTML = window.LyriaUI.icon('hash') + '<span class="channel-name"></span>';
                    button.querySelector('span').textContent = channel.name || 'Conversation';
                    button.classList.toggle('active-channel', channel.id === currentChannel);
                    button.setAttribute('aria-current', channel.id === currentChannel ? 'true' : 'false');
                    button.setAttribute('data-channel-id', channel.id);
                    button.onclick = () => {
                        switchChannel(channel.id,channel.name);
                        if (window.innerWidth <= 768) {
                            setMobileMenuOpen(false);
                        }
                    };

                    const favoriteButton = document.createElement('button');
                    favoriteButton.className = 'favorite-btn';
                    favoriteButton.innerHTML = window.LyriaUI.icon('star');
                    favoriteButton.setAttribute('aria-pressed', String(channel.favorite));
                    favoriteButton.setAttribute('aria-label', (channel.favorite ? 'Unfavorite ' : 'Favorite ') + channel.name);
                    favoriteButton.onclick = (e) => {
                        e.stopPropagation();
                        toggleFavoriteChannel(channel.id, !channel.favorite);
                    };

                    channelContainer.appendChild(button);
                    channelContainer.appendChild(favoriteButton);
                    channelElement.appendChild(channelContainer);
                    channelsList.appendChild(channelElement);
                });
                window.LyriaReadState.setRooms(channels);
        })
        .catch(error => {
            if(version!==channelLoadVersion)return;
            window.LyriaConnection?.fail('channels','Your conversations couldn’t load. Try reconnecting.');
            console.error("Error loading channels:", error);
            document.getElementById('hub-conversations').append(Object.assign(document.createElement('p'),{textContent:'Your other conversations couldn’t load. Use Reconnect to try again.'}));
        });
}


function loadMessages(channelId,{unreadOnly=false}={}) {
    const readFrom=window.LyriaReadState.lastRead(channelId);
    try{const url=new URL(location.href);if(unreadOnly)url.searchParams.set('view','unread');else url.searchParams.delete('view');history.replaceState(null,'',url)}catch{}
    document.getElementById('back-to-latest').hidden=!unreadOnly;

    const version=++messageLoadVersion;
    window.LyriaConnection?.pending('messages');
    unsubscribeFromMessages?.();
    const container = document.getElementById('messages');
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('chat')+'</span><p>Loading your conversation…</p></div>';
    let firstSnapshot = true;
    const subtitle=document.querySelector('.chat-subtitle');
    const notice=document.getElementById('community-notice');
    if(notice)notice.hidden=channelId !== COMMUNITY_CHANNEL_ID;
    if(subtitle)subtitle.textContent=channelId === COMMUNITY_CHANNEL_ID?'Everyone signed in to LYRIA can read this room.':'A little space to stay connected.';
    renderChannelIdentity(channelId);
    if(!channelNames.has(channelId))window.LyriaDataAPI.read('channels/'+channelId).then(doc=>{
        if(version===messageLoadVersion && currentChannel===channelId && doc.exists)rememberChannelName(channelId,doc.data().name);
    }).catch(error=>console.warn('Channel details unavailable',error));
    unsubscribeFromMessages = window.LyriaDataAPI.watch(
        (unreadOnly?db.collection('channels').doc(channelId).collection('messages').where('timestamp','>',new Date(readFrom)).orderBy('timestamp').limit(100):db.collection('channels').doc(channelId).collection('messages').orderBy('timestamp').limitToLast(100)),
        'messages',{parent:'channels/'+channelId,...(unreadOnly?{where:{fieldFilter:{field:{fieldPath:'timestamp'},op:'GREATER_THAN',value:{timestampValue:new Date(readFrom).toISOString()}}}}:{}),orderBy:[{field:{fieldPath:'timestamp'},direction:unreadOnly?'ASCENDING':'DESCENDING'}],limit:100,reverse:!unreadOnly,onHealthy:()=>window.LyriaConnection?.ready('messages')},snapshot => {
        if (currentChannel !== channelId || version!==messageLoadVersion) return;
        if(snapshot.metadata?.fromCache){window.LyriaConnection?.pending('messages')}else window.LyriaConnection?.ready('messages');
        const nearBottom = firstSnapshot || container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        const previousTop = container.scrollTop;
        const users = new Map();
        const readAt=window.LyriaReadState.lastRead(channelId);let firstUnread=null;
        window.LyriaMentions.setPeople(snapshot.docs.map(doc=>doc.data()));
        container.replaceChildren();
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('chat')+'</span><h2>A fresh conversation.</h2><p>Say hello, share an idea, or invite your people. This space is yours.</p></div>';
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const message = document.createElement('article'); message.className = 'message';message.dataset.senderId=data.senderId || '';if(data.type==='system' || !data.senderId)message.classList.add('system-message');
            const sender = document.createElement('div'); sender.className = 'sender';
            const profile = document.createElement(data.senderId ? 'button' : 'span');profile.className='sender-profile';
            const avatar = document.createElement('img');avatar.className='sender-avatar';avatar.src=data.senderPhotoURL || 'assets/avatar.svg';avatar.alt='';avatar.width=34;avatar.height=34;
            const name = document.createElement('span');name.className='sender-name';name.textContent=data.sender || data.displayName || 'LYRIA member';
            profile.append(avatar,name);
            if(data.senderId){profile.type='button';profile.setAttribute('aria-label','View '+name.textContent+'’s profile');profile.addEventListener('click',()=>showUserProfileModal(data.senderId))}
            sender.append(profile);
            const time=document.createElement('time');time.className='message-timestamp';
            const date=data.timestamp?.toDate?.();
            if(date){time.dateTime=date.toISOString();time.textContent=date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});time.title=date.toLocaleString()}else{time.textContent='Sending…'}
            sender.append(time);
            if(data.senderId){
                const inlineBadges=document.createElement('span');inlineBadges.className='message-badges';inlineBadges.dataset.userId=data.senderId;sender.append(inlineBadges);
                if(!users.has(data.senderId))users.set(data.senderId,window.LyriaDataAPI.read((data.senderId===currentUser.uid?'users/':'profiles/')+data.senderId));
                users.get(data.senderId).then(user=>{
                    if(!message.isConnected || !user.exists)return;
                    avatar.src=window.LyriaMedia.profileSource(user.data());
                    name.textContent=user.data().displayName || name.textContent;
                    const ownProfile=window.LyriaAccount.getProfile();
                    const badgeProfile=data.senderId===firebase.auth().currentUser?.uid && Object.keys(ownProfile).length?ownProfile:user.data();
                    window.LyriaBadges.render(inlineBadges,badgeProfile,data.senderId,{inline:true});
                }).catch(error=>console.warn('Badges unavailable',error));
            }
            const content=document.createElement('div');content.className='message-content';
            if(data.type==='gif'){
                window.LyriaMedia.renderGif(content,data,{onLoad:()=>{if(nearBottom && container.scrollHeight-container.scrollTop-container.clientHeight<140)container.scrollTop=container.scrollHeight}});
            }else{content.textContent=data.message || data.content || ''}
            const at=data.timestamp?.toMillis?.() || data.timestamp?.toDate?.().getTime() || 0;
            if(!firstUnread && at>readAt && data.senderId!==currentUser.uid){firstUnread=document.createElement('div');firstUnread.id='first-unread-marker';firstUnread.className='first-unread-marker';firstUnread.textContent='New since your last read';container.append(firstUnread)}
            if(Array.isArray(data.mentions) && data.mentions.includes(currentUser.uid)){message.classList.add('message-mentioned');const label=document.createElement('span');label.className='mention-label';label.textContent='Mentioned you';sender.append(label)}
            message.append(sender,content);
            window.LyriaReactions?.mount(message,data,channelId,doc.id,()=>unsubscribeFromMessages?.refresh?.());
            window.LyriaSafety?.mount(message,data,channelId,doc.id);
            container.append(message);
        });
        container.scrollTop=nearBottom?container.scrollHeight:previousTop;
        if(firstSnapshot && firstUnread)container.scrollTop=firstUnread.offsetTop-container.offsetTop;
        document.getElementById('unread-actions').hidden=!firstUnread && !unreadOnly;
        window.LyriaReadState.rendered(channelId,snapshot.docs,unreadOnly);
        firstSnapshot=false;
    },error=>{
        if(currentChannel!==channelId || version!==messageLoadVersion)return;
        window.LyriaConnection?.fail('messages','Your conversation disconnected. Try reconnecting.');
        console.error(error);
        if (error.code === 'permission-denied' && channelId === COMMUNITY_CHANNEL_ID) {
            communityAccessDenied = true;
            if (!usedCommunityFallback) {
                usedCommunityFallback = true;
                window.LyriaUI.notify('Everyone is not available yet. Your personal conversations are still available.');
                const personalId = `personal-${currentUser.uid}`;
                db.collection('channels').doc(personalId).get().then(doc=>{
                    if(doc.exists && currentChannel === COMMUNITY_CHANNEL_ID)switchChannel(personalId);
                }).catch(error=>console.warn('Personal conversation fallback unavailable',error));
            }
        }
        const detail=error.code === 'permission-denied' ? (channelId === COMMUNITY_CHANNEL_ID ? 'Everyone is not available yet. You can still use your personal conversations.' : 'Your account no longer has access to this conversation.') : 'Check your connection and try again.';
        container.innerHTML='<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('info')+'</span><h2>This conversation couldn’t load.</h2><p>'+detail+'</p><button type="button">Try again</button></div>';
        container.querySelector('button').addEventListener('click',()=>loadMessages(channelId));
    });
}


function logout() {
    const owner=currentUser?.uid;
    window.leaveCurrentCall?.();
    auth.signOut().then(() => {
        exitingAccount=true;try{for(const key of Object.keys(sessionStorage))if(key.startsWith('lyria:message-draft:'+owner+':') || key.startsWith('lyria:message-retry:'+owner+':'))sessionStorage.removeItem(key)}catch{}
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Error logging out:", error);
        window.LyriaUI.notify('Failed to log out.');
    });
}

// Function to switch channels
function switchChannel(channelId,name,historyMode='push') {
    const restoreUnread=historyMode==='replace' && new URLSearchParams(location.search).get('view')==='unread';
    document.querySelector('.chat-area').dataset.view='chat';
    document.getElementById('conversation-hub').hidden=true;
    document.getElementById('open-hub').setAttribute('aria-current','false');
    ++channelSelectionVersion;
    const savedName=name || channelNames.get(channelId) || (channelId===`personal-${currentUser?.uid}`?'My personal channel':'Conversation');
    try{if(currentUser)localStorage.setItem('lyria:last-conversation:'+currentUser.uid,JSON.stringify({id:channelId,name:savedName}))}catch{}
    try{const url=new URL(location.href);if(!restoreUnread)url.searchParams.delete('view');url.searchParams.set('channel',channelId);if(url.href!==location.href)history[historyMode+'State'](null,'',url)}catch{}

    if(currentChannel && currentChannel!==channelId)window.LyriaVoiceView?.showChat();
    if (currentChannel && currentChannel !== channelId) setTypingStatus(false);
    saveMessageDraft();
    currentChannel = channelId;
    restoreMessageDraft();
    window.LyriaReadState?.setActive(channelId);
    window.LyriaMentions?.setPeople([]);
    rememberChannelName(channelId,name);
    const leaveButton = document.getElementById('leave-channel');
    if (leaveButton && currentUser) {
        const isPersonalChannel = channelId === `personal-${currentUser.uid}`;
        const isCommunity = channelId === COMMUNITY_CHANNEL_ID;
        leaveButton.disabled = isPersonalChannel || isCommunity;
        leaveButton.textContent = isCommunity ? 'Everyone is always here' : isPersonalChannel ? 'Personal channel' : 'Leave conversation';
        leaveButton.title = isCommunity ? 'This shared room is open to every signed-in member.' : isPersonalChannel ? 'Your personal channel always stays with your account.' : 'Leave this conversation';
    }
    document.querySelectorAll('.channel-btn').forEach(button => {
        const active = button.dataset.channelId === channelId;
        button.classList.toggle('active-channel', active); button.setAttribute('aria-current', String(active));
    });
    loadMessages(channelId,{unreadOnly:restoreUnread});     // Load messages for the new channel
    listenForTypingStatus(channelId); // Listen for typing status changes
    const voiceButton = document.getElementById('make-voice-call');
    voiceButton.disabled = false; voiceButton.title = 'Join voice (up to 6 people)';

}

// Function to open the modal
function openModal() { window.LyriaUI.openModal(document.getElementById('settings-modal')); }
function closeModal() { window.LyriaUI.closeModal(document.getElementById('settings-modal')); }
document.getElementById('settings-btn')?.addEventListener('click', openModal);
document.getElementById('close-modal')?.addEventListener('click', closeModal);

const userProfileTrigger = document.getElementById('user-profile-trigger');
if (userProfileTrigger) {
    userProfileTrigger.addEventListener('click', () => {
        showUserProfileModal(currentUser ? currentUser.uid : null);
    });
} else {
    console.error("User profile trigger not found.");
}




// Profile modal click handler moved above



// Global variable to store the profile user ID
let profileUserId = null;

function renderProfileBadges(profile,uid){
    const count=window.LyriaBadges.render(document.getElementById('profile-modal-badges'),profile,uid);
    const empty=document.getElementById('profile-badges-empty');empty.hidden=count>0;empty.textContent=profile.showBadges===false?'Badges hidden':'No badges yet';
}
window.addEventListener('lyria:profile-updated',event=>{
    const {uid,profile}=event.detail;
    document.querySelectorAll('.message-badges').forEach(container=>{if(container.dataset.userId===uid)window.LyriaBadges.render(container,profile,uid,{inline:true})});
    if(document.getElementById('profile-modal')?.dataset.userId===uid)renderProfileBadges(profile,uid);
});

window.addEventListener('lyria:open-member-profile',event=>{const uid=event.detail?.uid;if(typeof uid==='string' && uid.length<=128)showUserProfileModal(uid)});

// One registry supplies profile and inline badge artwork and descriptions.
function showUserProfileModal(uid,{canOpen=()=>true}={}) {
    if (!uid || !db) return;
    const viewer=currentUser?.uid;
    profileUserId = uid; // Set the profileUserId to the ID of the user being viewed

    return window.LyriaDataAPI.read((uid===currentUser?.uid?'users/':'profiles/')+uid).then(doc => {
        if(profileUserId!==uid || firebase.auth().currentUser?.uid!==viewer || !canOpen())return;
        if (doc.exists) {
            const userData = doc.data();
            const profileName = userData.displayName || 'User';
            const profileImage = document.getElementById('profile-modal-image');
            profileImage.src = window.LyriaMedia.profileSource(userData);
            document.getElementById('profile-modal').dataset.userId=uid;
            window.LyriaMedia.profileBanner(document.getElementById('profile-banner-image'),userData);
            profileImage.alt = `${profileName} avatar`;
            document.getElementById('profile-modal-name').textContent = profileName;
            document.getElementById('profile-modal-status').textContent = userData.status
                ? userData.status.charAt(0).toUpperCase() + userData.status.slice(1)
                : 'LYRIA member';
            document.getElementById('profile-modal-bio').textContent = userData.bio || 'No bio added yet.';

            renderProfileBadges(userData,uid);
            window.LyriaSafety?.profile(uid);

            // Show the friend request button if the user is not the current user
            const currentUser = firebase.auth().currentUser;
            const sendFriendRequestBtn = document.getElementById('send-friend-request');
            document.getElementById('call-profile-user').hidden=uid===currentUser?.uid || !window.LyriaAccount.getProfile().friends?.includes(uid);

            if (currentUser && currentUser.uid !== uid) {
                sendFriendRequestBtn.style.display = 'block'; // Show the button
            } else {
                sendFriendRequestBtn.style.display = 'none'; // Hide the button if it's the same user
            }

            const profileModal = document.getElementById('profile-modal');
            setMobileMenuOpen(false);
            window.LyriaUI.openModal(profileModal);
        }
    }).catch(error => {
        console.error("Error fetching user data:", error);
        window.LyriaUI.notify('Failed to fetch user profile.');
    });
}

// Add friend request functionality
document.getElementById('send-friend-request').addEventListener('click', async () => {
    const button=document.getElementById('send-friend-request'),target=profileUserId;
    if(button.disabled)return;button.disabled=true;
    try{await window.LyriaFriendRequests.send(target);window.LyriaUI.notify('Friend request sent.','success')}
    catch(error){console.warn('Sending friend request failed',error);window.LyriaUI.notify(error.message || 'Couldn’t confirm the friend request. Reconnect and try again.','error')}
    finally{button.disabled=false}
});

function toggleFavoriteChannel(channelId, isFavorite) {
    const userDocRef = db.collection('users').doc(currentUser.uid); // Reference to the current user's document

    if (isFavorite) {
        // Add the channel ID to the user's favorite channels
        userDocRef.update({
            favoriteChannels: firebase.firestore.FieldValue.arrayUnion(channelId)
        }).then(() => {
            loadChannels(); // Reload channels to reflect changes
        }).catch(error => {
            console.error("Error adding favorite channel:", error);
            window.LyriaUI.notify('Failed to update favorite status.');
        });
    } else {
        // Remove the channel ID from the user's favorite channels
        userDocRef.update({
            favoriteChannels: firebase.firestore.FieldValue.arrayRemove(channelId)
        }).then(() => {
            loadChannels(); // Reload channels to reflect changes
        }).catch(error => {
            console.error("Error removing favorite channel:", error);
            window.LyriaUI.notify('Failed to update favorite status.');
        });
    }
}



}).catch(error=>{
    console.error('Chat startup failed',error);
    window.LyriaConnection?.fail('startup','LYRIA couldn’t finish loading. Reload to try again.');
});
