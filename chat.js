// Use the configured Firebase instances from config.js
let auth, db;

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
let darkMode = false;
let notificationsEnabled = false;
let lastMessageTimestamp = null;
let unsubscribeFromMessages = null;
let unsubscribeTyping = null; // Unsubscribe function for message listener
let uiListenersAttached = false;

// Create notification sound
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Define an array of UIDs for users who should have badges
const badgeUserUIDs = ["qzf9fO2bBLU0PJhRDSQK9KnMZD32", "xLT0XKgtF5ZnlfX2fLj9hXrTcW02"]; // Replace with actual UIDs

// Hardcoded badge details
const badgeDetails = {
    "Beta": {
        description: "Awarded to beta testers.",
        userCount: 150 // Example number of users who have this badge
    },
    "admin": {
        description: "Awarded to administrators.",
        userCount: 2 // Example number of users who have this badge
    },
    "VIP": {
        description: "Awarded to very important persons.",
        userCount: 30 // Example number of users who have this badge
    },
    // Add more badges as needed
};

// Function to display badges with hover tooltips
function displayBadges(userId) {
    const badgesContainer = document.getElementById('profile-modal-badges');
    badgesContainer.innerHTML = ''; // Clear previous badges

    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();

            if (userData.badges && Array.isArray(userData.badges)) {
                userData.badges.forEach(badge => {
                    const badgeDiv = document.createElement('div');
                    badgeDiv.className = 'badge';
                    badgeDiv.setAttribute('data-badge-name', badge);

                    const badgeImage = document.createElement('img');
                    badgeImage.src = `assets/${badge}.png`; // Assuming badge images are stored in assets
                    badgeImage.alt = `${badge} Badge`;
                    badgeImage.className = 'badge-image';
                    badgeImage.width = 28;
                    badgeImage.height = 28;

                    // Add a tooltip for badge details
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip';
                    const details = badgeDetails[badge];
                    if (details) {
                        tooltip.innerHTML = `
                            <strong>${badge}</strong><br>
                            ${details.description}<br>
                            <strong>Users:</strong> ${details.userCount}
                        `;
                    } else {
                        tooltip.innerHTML = `<strong>${badge}</strong><br>No details available.`;
                    }

                    badgeDiv.appendChild(badgeImage);
                    badgeDiv.appendChild(tooltip);
                    badgesContainer.appendChild(badgeDiv);

                    // Show tooltip on hover
                    badgeDiv.addEventListener('mouseenter', () => {
                        tooltip.style.visibility = 'visible';
                        tooltip.style.opacity = '1';
                    });

                    badgeDiv.addEventListener('mouseleave', () => {
                        tooltip.style.visibility = 'hidden';
                        tooltip.style.opacity = '0';
                    });
                });
            }
        }
    }).catch(error => {
        console.error("Error fetching user data:", error);
    });
}

const featureUserUIDs = ["miu0tI2oHJUiNx2gxtPwSpJ136w1", "dIc6q6xdqsTuiVC9JWGQT9XVH6T2"]; // Add the UID for the feature badge

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
    sidebar.setAttribute('aria-hidden', (isMobile && !shouldOpen).toString());
    sidebar.toggleAttribute('inert', isMobile && !shouldOpen);

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
        console.error('Auth not initialized');
        return;
    }

    // Make every control responsive immediately; data-dependent actions already
    // guard currentUser/currentChannel until authentication finishes.
    setupUIEventListeners();

    // Use one authentication path for user setup, channel setup and UI listeners.
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;
        const personalChannelId = `personal-${user.uid}`;
        const userDocRef = db.collection('users').doc(user.uid);
        const channelDocRef = db.collection('channels').doc(personalChannelId);

        try {
            const existingUser = await userDocRef.get();
            if (!existingUser.exists) {
                await userDocRef.set({
                    displayName: user.displayName || (user.isAnonymous ? 'Guest' : 'User'),
                    email: user.email || null,
                    photoURL: user.photoURL || 'assets/icon.png',
                    role: user.isAnonymous ? 'guest' : 'user',
                    channels: [personalChannelId],
                    friends: [],
                    badges: [],
                    darkMode: false,
                    notificationsEnabled: false,
                    bio: 'No bio set.'
                });
            } else {
                await userDocRef.set({
                    channels: firebase.firestore.FieldValue.arrayUnion(personalChannelId)
                }, { merge: true });
            }

            const existingChannel = await channelDocRef.get();
            if (!existingChannel.exists) {
                await channelDocRef.set({
                    name: 'My Personal Channel',
                    id: personalChannelId,
                    createdBy: user.uid,
                    joinCode: generateJoinCode(),
                    members: [user.uid],
                    isPublic: false
                });
            } else {
                await channelDocRef.update({
                    members: firebase.firestore.FieldValue.arrayUnion(user.uid)
                });
            }

            const refreshedUser = await userDocRef.get();
            const userData = refreshedUser.data() || {};
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            if (nameEl) nameEl.textContent = userData.displayName || 'User';
            if (avatarEl) avatarEl.src = userData.photoURL || 'assets/icon.png';
            const bioInput = document.getElementById('bio-input');
            if (bioInput) bioInput.value = userData.bio || '';
            showBadges = userData.showBadges !== false;
            if (badgeUserUIDs.includes(user.uid)) {
                const badgeSection = document.getElementById('badge-visibility-section');
                const badgeToggle = document.getElementById('badge-visibility-toggle');
                if (badgeSection) badgeSection.style.display = 'block';
                if (badgeToggle) badgeToggle.checked = showBadges;
            }
            applyBadgeVisibility();

            darkMode = Boolean(userData.darkMode);
            notificationsEnabled = Boolean(userData.notificationsEnabled);
            const notificationsToggle = document.getElementById('notifications-toggle');
            if (notificationsToggle) notificationsToggle.checked = notificationsEnabled;
            applyDarkMode();

            document.getElementById('add-channel')?.removeAttribute('disabled');
            document.getElementById('join-channel')?.removeAttribute('disabled');

            currentChannel = personalChannelId;
            setupUIEventListeners();
            loadChannels();
            switchChannel(personalChannelId);

        } catch (error) {
            console.error('Error initializing the community:', error);
            window.utils?.showError('LYRIA could not finish loading your community. Please refresh and try again.');
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
        if (event.key === 'Escape') closeProfileModal();
    });

    // Toggle Dark Mode
    document.getElementById('toggle-dark-mode').addEventListener('click', () => {
        if (!currentUser) return;
        darkMode = !darkMode;
        applyDarkMode();
        db.collection('users').doc(currentUser.uid).update({
            darkMode: darkMode
        }).catch(error => {
            console.error("Error updating dark mode:", error);
        });
    });

    // Update Display Name
    document.getElementById('update-display-name').addEventListener('click', () => {
        if (!currentUser) return;
        const newName = document.getElementById('display-name-input').value.trim();
        if(newName) {
            // Update display name in Firebase Authentication
            currentUser.updateProfile({
                displayName: newName
            }).then(() => {
                // Update display name in Firestore
                return db.collection('users').doc(currentUser.uid).update({
                    displayName: newName
                });
            }).then(() => {
                // Update the display name in the UI
                document.getElementById('user-name').textContent = newName;
                currentUser.displayName = newName; // Update the currentUser object
                document.getElementById('display-name-input').value = '';
                window.LyriaUI.notify('Display name updated successfully!');
            }).catch(error => {
                console.error("Error updating display name:", error);
                window.LyriaUI.notify('Failed to update display name');
            });
        }
    });

    // Toggle Notifications
    document.getElementById('notifications-toggle').addEventListener('change', (e) => {
        if (!currentUser) return;
        if (!('Notification' in window)) { e.target.checked = false; window.LyriaUI.notify('Notifications are not supported in this browser.'); return; }
        notificationsEnabled = e.target.checked;
        if(notificationsEnabled) {
            Notification.requestPermission().then(permission => {
                if(permission !== 'granted') {
                    window.LyriaUI.notify('Notifications permission denied.');
                    document.getElementById('notifications-toggle').checked = false;
                    notificationsEnabled = false;
                    db.collection('users').doc(currentUser.uid).update({
                        notificationsEnabled: notificationsEnabled
                    }).catch(error => {
                        console.error("Error updating notifications:", error);
                    });
                }
            });
        }
        db.collection('users').doc(currentUser.uid).update({
            notificationsEnabled: notificationsEnabled
        }).catch(error => {
            console.error("Error updating notifications:", error);
        });
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
                ? 'Enter the invite code shared by a LYRIA member.'
                : 'You will need a new invite code to return later.';
        channelActionField.hidden = isLeave;
        channelActionLabel.textContent = mode === 'create' ? 'Conversation name' : 'Invite code';
        channelActionInput.placeholder = mode === 'create' ? 'e.g. Design club' : 'Enter invite code';
        channelActionInput.maxLength = mode === 'create' ? 48 : 12;
        channelActionSubmit.textContent = mode === 'create' ? 'Create' : mode === 'join' ? 'Join' : 'Leave';
        channelActionSubmit.classList.toggle('danger-action', isLeave);
        channelActionFeedback.textContent = '';
        channelActionModal.removeAttribute('inert');
        channelActionModal.setAttribute('aria-hidden', 'false');
        channelActionModal.style.display = 'flex';
        setMobileMenuOpen(false);
        (isLeave ? channelActionSubmit : channelActionInput).focus();
    };

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
                const batch = db.batch();
                batch.set(channelRef, {
                    name: value,
                    id: channelId,
                    createdBy: currentUser.uid,
                    joinCode: generateJoinCode(),
                    members: [currentUser.uid],
                    isPublic: false,
                    favorite: false
                });
                batch.set(userDocRefForCurrentUser(), {
                    channels: firebase.firestore.FieldValue.arrayUnion(channelId)
                }, { merge: true });
                await batch.commit();

                switchChannel(channelId);
                loadChannels();
                closeChannelActionModal();

                // A welcome message is helpful but should never make channel creation appear to fail.
                channelRef.collection('messages').add({
                    message: `Welcome to ${value}, ${currentUser.displayName || 'User'}!`,
                    sender: 'System',
                    type: 'system',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(error => console.warn('Welcome message could not be posted:', error));
            } else if (mode === 'join') {
                const snapshot = await db.collection('channels').where('joinCode', '==', value.toUpperCase()).get();
                if (snapshot.empty) {
                    channelActionFeedback.textContent = 'That invite code was not found.';
                    return;
                }
                const channelDoc = snapshot.docs[0];
                const channel = channelDoc.data();
                const channelId = channel.id || channelDoc.id;
                await db.collection('channels').doc(channelId).update({
                    members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
                await userDocRefForCurrentUser().set({
                    channels: firebase.firestore.FieldValue.arrayUnion(channelId)
                }, { merge: true });
                switchChannel(channelId);
                loadChannels();
                closeChannelActionModal();
            } else {
                const personalChannelId = `personal-${currentUser.uid}`;
                if (!currentChannel || currentChannel === personalChannelId) return;
                const leavingChannelId = currentChannel;
                const channelRef = db.collection('channels').doc(leavingChannelId);
                await Promise.all([
                    channelRef.update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) }),
                    userDocRefForCurrentUser().set({
                        channels: firebase.firestore.FieldValue.arrayRemove(leavingChannelId),
                        favoriteChannels: firebase.firestore.FieldValue.arrayRemove(leavingChannelId)
                    }, { merge: true })
                ]);
                switchChannel(personalChannelId);
                loadChannels();
                closeChannelActionModal();
            }
        } catch (error) {
            console.error(`Channel ${mode} failed:`, error);
            channelActionFeedback.textContent = error.code === 'permission-denied'
                ? 'LYRIA could not save that change. Please sign out, sign back in, and try once more.'
                : 'That action could not be completed. Please try again.';
        } finally {
            isSubmittingChannelAction = false;
            channelActionSubmit.disabled = false;
        }
    });

    // Clipboard failures still leave the invite code available to the user.
    document.getElementById('copy-join-code').addEventListener('click', async () => {
        if (!currentChannel || !db) return;
        try {
            const doc = await db.collection('channels').doc(currentChannel).get();
            const code = doc.data()?.joinCode;
            if (!code) { window.LyriaUI.notify('This conversation does not have an invite code yet.'); return; }
            try {
                await navigator.clipboard.writeText(code);
                window.LyriaUI.notify('Invite code copied: ' + code, 'success');
            } catch {
                window.LyriaUI.notify('Invite code: ' + code + '. Share this code with your friends.');
            }
        } catch (error) {
            console.error(error); window.LyriaUI.notify('Could not load the invite code. Please try again.', 'error');
        }
    });
}

function userDocRefForCurrentUser() {
    return db.collection('users').doc(currentUser.uid);
}

let isSendingMessage = false;
async function sendMessage(messageText, isCode = false) {
    if (isSendingMessage || typeof messageText !== 'string' || !messageText.trim()) return;
    if (!currentUser || !currentChannel || !db) { window.LyriaUI.notify('Wait for your conversation to finish loading.'); return; }
    if (messageText.length > 4000) { window.LyriaUI.notify('Keep messages under 4,000 characters.'); return; }
    const input = document.getElementById('message-input');
    const button = document.getElementById('send-button');
    const channelId = currentChannel;
    const draft = input.value;
    isSendingMessage = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
    try {
        await db.collection('channels').doc(channelId).collection('messages').add({
            message: messageText.trim(),
            sender: document.getElementById('user-name').textContent || currentUser.displayName || 'LYRIA member',
            senderId: currentUser.uid,
            senderPhotoURL: document.getElementById('user-avatar').src || 'assets/avatar.svg',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (input.value === draft && currentChannel === channelId) { input.value = ''; input.style.height = ''; }
        setTypingStatus(false);
    } catch (error) {
        console.error(error); window.LyriaUI.notify('Message not sent. Your draft is still here; try again.', 'error');
    } finally {
        isSendingMessage = false; button.disabled = false; button.removeAttribute('aria-busy');
    }
}

window.sendGifByUrl = async function sendGifByUrl(gifUrl) {
    if (!currentUser || !currentChannel) throw new Error('No active channel');
    const parsedUrl = new URL(gifUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Invalid GIF URL');

    await db.collection('channels').doc(currentChannel).collection('messages').add({
        message: parsedUrl.href,
        content: parsedUrl.href,
        type: 'gif',
        sender: currentUser.displayName || 'Guest',
        displayName: currentUser.displayName || 'Guest',
        senderId: currentUser.uid,
        senderPhotoURL: currentUser.photoURL || 'assets/icon.png',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
};
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setTypingStatus(isTyping) {
    if (currentChannel && currentUser) {
        const typingRef = db.collection('channels').doc(currentChannel)
            .collection('typingStatus').doc(currentUser.uid);

        if (isTyping) {
            typingRef.set({
                displayName: currentUser.displayName || 'User',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(error => {
                console.error("Error setting typing status:", error);
            });
        } else {
            typingRef.delete().catch(error => {
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
            if (doc.id !== currentUser.uid && (!updated || Date.now() - updated.getTime() < 15000)) {
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
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '';

    // Get channels where user is a member
    db.collection('channels')
        .where('members', 'array-contains', currentUser.uid)
        .get()
        .then(snapshot => {
            const userDocRef = db.collection('users').doc(currentUser.uid);
            return userDocRef.get().then(userDoc => {
                const userData = userDoc.data();
                const favoriteChannels = userData.favoriteChannels || []; // Get user's favorite channels

                const channels = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    favorite: favoriteChannels.includes(doc.id) // Set favorite based on user's favorites
                }));

                // Sort channels: favorites first
                channels.sort((a, b) => (b.favorite === a.favorite) ? 0 : (b.favorite ? 1 : -1));

                channels.forEach(channel => {
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
                        switchChannel(channel.id);
                        document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active-channel'));
                        button.classList.add('active-channel');
                        document.getElementById('message-input').placeholder = `Message #${channel.name}`;
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
            });
        })
        .catch(error => {
            console.error("Error loading channels:", error);
        });
}

function generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function loadMessages(channelId) {
    unsubscribeFromMessages?.();
    const container = document.getElementById('messages');
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('chat')+'</span><p>Loading your conversation…</p></div>';
    let firstSnapshot = true;
    db.collection('channels').doc(channelId).get().then(doc => {
        if (doc.exists && currentChannel === channelId) {
            const name = doc.data().name || 'Conversation';
            document.getElementById('channel-title').textContent = name;
            document.getElementById('message-input').placeholder = 'Message ' + name + '…';
        }
    }).catch(error => console.error('Channel details unavailable', error));
    unsubscribeFromMessages = db.collection('channels').doc(channelId).collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
        if (currentChannel !== channelId) return;
        const nearBottom = firstSnapshot || container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        const previousTop = container.scrollTop;
        const users = new Map();
        container.replaceChildren();
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('chat')+'</span><h2>A fresh conversation.</h2><p>Say hello, share an idea, or invite your people. This space is yours.</p></div>';
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const message = document.createElement('article'); message.className = 'message';
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
                if(!users.has(data.senderId))users.set(data.senderId,db.collection('users').doc(data.senderId).get());
                users.get(data.senderId).then(user=>{
                    if(!message.isConnected || !user.exists || user.data().showBadges===false)return;
                    const badges = Array.isArray(user.data().badges) ? user.data().badges : [];
                    badges.forEach(badge=>{if(!/^[a-zA-Z0-9_-]+$/.test(badge))return;const img=document.createElement('img');img.src='assets/'+badge+'.png';img.alt=badge+' badge';img.className='admin-badge';img.width=18;img.height=18;sender.append(img)});
                }).catch(error=>console.warn('Badges unavailable',error));
            }
            const content=document.createElement('div');content.className='message-content';
            if(data.type==='gif'){
                try{const url=new URL(data.content || data.message);if(!['https:','http:'].includes(url.protocol))throw new Error('Unsupported image URL');const img=document.createElement('img');img.src=url.href;img.alt='Shared GIF';img.loading='lazy';img.addEventListener('load',()=>{if(nearBottom)container.scrollTop=container.scrollHeight});content.append(img)}catch{content.textContent='This image is unavailable.'}
            }else{content.textContent=data.message || data.content || ''}
            message.append(sender,content);container.append(message);
        });
        container.scrollTop=nearBottom?container.scrollHeight:previousTop;
        firstSnapshot=false;
    },error=>{
        console.error(error);
        container.innerHTML='<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('info')+'</span><h2>This conversation couldn’t load.</h2><p>Check your connection and try again.</p><button type="button">Try again</button></div>';
        container.querySelector('button').addEventListener('click',()=>loadMessages(channelId));
    });
}

function applyDarkMode() {
    document.body.classList.toggle('contrast-mode', darkMode);
    const toggle = document.getElementById('toggle-dark-mode');
    toggle?.setAttribute('aria-pressed', String(darkMode));
    if (toggle) toggle.innerHTML = window.LyriaUI.icon('contrast') + (darkMode ? 'Use standard contrast' : 'Increase contrast');
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Error logging out:", error);
        window.LyriaUI.notify('Failed to log out.');
    });
}

// Function to switch channels
function switchChannel(channelId) {
    if (currentChannel && currentChannel !== channelId && typeof window.leaveCurrentCall === 'function') {
        window.leaveCurrentCall();
    }
    if (currentChannel && currentChannel !== channelId) setTypingStatus(false);
    currentChannel = channelId; // Update currentChannel when switching channels
    const leaveButton = document.getElementById('leave-channel');
    if (leaveButton && currentUser) {
        const isPersonalChannel = channelId === `personal-${currentUser.uid}`;
        leaveButton.disabled = isPersonalChannel;
        leaveButton.textContent = isPersonalChannel ? 'Personal channel' : 'Leave conversation';
        leaveButton.title = isPersonalChannel ? 'Your personal channel always stays with your account.' : 'Leave this conversation';
    }
    document.querySelectorAll('.channel-btn').forEach(button => {
        const active = button.dataset.channelId === channelId;
        button.classList.toggle('active-channel', active); button.setAttribute('aria-current', String(active));
    });
    loadMessages(channelId);     // Load messages for the new channel
    listenForTypingStatus(channelId); // Listen for typing status changes
    if (typeof window.setupCallListeners === 'function') window.setupCallListeners();
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



let showBadges = true; // Default value for showing badges

// Event listener for badge visibility toggle
document.getElementById('badge-visibility-toggle').addEventListener('change', (e) => {
    showBadges = e.target.checked;
    applyBadgeVisibility();

    // Save the setting to Firestore
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            showBadges: showBadges
        }).catch(error => {
            console.error("Error saving badge visibility setting:", error);
        });
    }
});

// Function to apply badge visibility in the profile modal and chat
function applyBadgeVisibility() {
    const profileBadges = document.getElementById('profile-modal-badges');
    if (profileBadges) {
        profileBadges.style.display = showBadges ? 'flex' : 'none';
    }

    document.querySelectorAll('.admin-badge').forEach(badge => {
        badge.style.display = showBadges ? 'inline-block' : 'none';
    });
}

// Global variable to store the profile user ID
let profileUserId = null;

// Modify showUserProfileModal to respect the badge visibility setting
function showUserProfileModal(uid) {
    if (!uid || !db) return;
    profileUserId = uid; // Set the profileUserId to the ID of the user being viewed

    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            const profileName = userData.displayName || 'User';
            const profileImage = document.getElementById('profile-modal-image');
            profileImage.src = userData.photoURL || 'assets/icon.png';
            profileImage.alt = `${profileName} avatar`;
            document.getElementById('profile-modal-name').textContent = profileName;
            document.getElementById('profile-modal-status').textContent = userData.status
                ? userData.status.charAt(0).toUpperCase() + userData.status.slice(1)
                : 'LYRIA member';
            document.getElementById('profile-modal-bio').textContent = userData.bio || 'No bio added yet.';

            const profileBadges = document.getElementById('profile-modal-badges');
            profileBadges.innerHTML = ''; // Clear previous badges
            let renderedBadges = 0;

            // Check if the user has any badges
            if (userData.badges && Array.isArray(userData.badges)) {
                userData.badges.forEach(badge => {
                    const badgeDiv = document.createElement('button');
                    badgeDiv.type = 'button';
                    badgeDiv.className = 'badge';
                    badgeDiv.setAttribute('data-badge-name', badge);
                    badgeDiv.setAttribute('aria-label', `View ${badge} badge details`);

                    // Set the click event to show badge details
                    badgeDiv.onclick = () => {
                        const details = badgeDetails[badge];
                        if (details) {
                            window.LyriaUI.notify(badge + ': ' + details.description);
                        }
                    };

                    const badgeImage = document.createElement('img');
                    badgeImage.src = `assets/${badge}.png`; // Assuming badge images are stored in assets
                    badgeImage.alt = `${badge} Badge`;
                    badgeImage.className = 'badge-image';
                    badgeImage.width = 28;
                    badgeImage.height = 28;

                    const badgeLabel = document.createElement('span');
                    badgeLabel.className = 'profile-badge-label';
                    badgeLabel.textContent = badge;

                    badgeDiv.appendChild(badgeImage);
                    badgeDiv.appendChild(badgeLabel);
                    profileBadges.appendChild(badgeDiv);
                    renderedBadges += 1;
                });
            }

            // Check if the user has the feature badge
            if (featureUserUIDs.includes(uid)) {
                const featureBadgeWrap = document.createElement('div');
                featureBadgeWrap.className = 'badge';
                const featureBadge = document.createElement('img');
                featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                featureBadge.alt = 'Feature Badge';
                featureBadge.className = 'admin-badge'; // Use the same class for styling
                featureBadge.width = 28;
                featureBadge.height = 28;
                const featureLabel = document.createElement('span');
                featureLabel.className = 'profile-badge-label';
                featureLabel.textContent = 'Featured';
                featureBadgeWrap.append(featureBadge, featureLabel);
                profileBadges.appendChild(featureBadgeWrap);
                renderedBadges += 1;
            }

            document.getElementById('profile-badges-empty').hidden = renderedBadges > 0;

            // Show the friend request button if the user is not the current user
            const currentUser = firebase.auth().currentUser;
            const sendFriendRequestBtn = document.getElementById('send-friend-request');

            if (currentUser && currentUser.uid !== uid) {
                sendFriendRequestBtn.style.display = 'block'; // Show the button
            } else {
                sendFriendRequestBtn.style.display = 'none'; // Hide the button if it's the same user
            }

            const profileModal = document.getElementById('profile-modal');
            setMobileMenuOpen(false);
            profileModal.removeAttribute('inert');
            profileModal.setAttribute('aria-hidden', 'false');
            profileModal.style.display = 'flex';
            document.getElementById('close-profile-modal').focus();
        }
    }).catch(error => {
        console.error("Error fetching user data:", error);
        window.LyriaUI.notify('Failed to fetch user profile.');
    });
}

// Add friend request functionality
document.getElementById('send-friend-request').addEventListener('click', async () => {
    const currentUser = firebase.auth().currentUser; // Get the current user
    if (!currentUser || !profileUserId) {
        console.error("Missing user information");
        window.LyriaUI.notify('Unable to send friend request - missing user information');
        return; // Exit if user information is missing
    }

    console.log("Current User:", currentUser.uid);
    console.log("Profile User:", profileUserId);

    // Check if sending request to self
    if (currentUser.uid === profileUserId) {
        window.LyriaUI.notify('You cannot send a friend request to yourself');
        return;
    }

    // Check if already friends
    const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
    const currentUserData = currentUserDoc.data();
    if (currentUserData.friends && currentUserData.friends.includes(profileUserId)) {
        window.LyriaUI.notify('You are already friends with this user');
        return;
    }

    // Check if request already sent
    const existingRequest = await db.collection('friendRequests')
        .where('from', '==', currentUser.uid)
        .where('to', '==', profileUserId)
        .where('status', '==', 'pending')
        .get();

    if (!existingRequest.empty) {
        window.LyriaUI.notify('You have already sent a friend request to this user');
        return;
    }

    // Create friend request document
    await db.collection('friendRequests').add({
        from: currentUser.uid,
        to: profileUserId,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Add notification to recipient's inbox
    const senderName = currentUserData.displayName || 'Unknown User';
    await db.collection('inbox').add({
        recipientId: profileUserId,
        senderId: currentUser.uid,
        senderName: senderName,
        message: `${senderName} sent you a friend request!`,
        type: 'friendRequest',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    window.LyriaUI.notify('Friend request sent successfully!');
});

// Add a global variable to store the list of users
let usersList = [];

// Fetch users from Firestore and store them in usersList
function fetchUsers() {
    db.collection('users').get().then(snapshot => {
        usersList = snapshot.docs.map(doc => ({
            id: doc.id,
            displayName: doc.data().displayName || 'User'
        }));
    }).catch(error => {
        console.error("Error fetching users:", error);
    });
}

// Call fetchUsers when the app initializes
fetchUsers();

// Add event listener for input to handle tagging
const tagMessageInput = document.getElementById('message-input');
const suggestionsContainer = document.createElement('div');
suggestionsContainer.className = 'suggestions-container';
suggestionsContainer.setAttribute('aria-label', 'Mention a member');
document.body.appendChild(suggestionsContainer); // Append to body or a specific container

tagMessageInput.addEventListener('input', (e) => {
    const value = e.target.value;
    const atIndex = value.lastIndexOf('@');

    if (atIndex !== -1) {
        const query = value.substring(atIndex + 1).toLowerCase();
        const filteredUsers = usersList.filter(user => (user.displayName || '').toLowerCase().includes(query));

        // Clear previous suggestions
        suggestionsContainer.innerHTML = '';

        // Show suggestions
        filteredUsers.slice(0, 8).forEach(user => {
            const suggestionItem = document.createElement('button');
            suggestionItem.type = 'button';
            suggestionItem.textContent = user.displayName;
            suggestionItem.className = 'suggestion-item';
            suggestionItem.onclick = () => {
                // Replace the @username with the selected username
                const newMessage = value.substring(0, atIndex + 1) + user.displayName + ' ';
                tagMessageInput.value = newMessage;
                suggestionsContainer.innerHTML = ''; // Clear suggestions
                tagMessageInput.focus(); // Refocus on input
            };
            suggestionsContainer.appendChild(suggestionItem);
        });

        // Position the suggestions container above the message input
        suggestionsContainer.style.display = filteredUsers.length ? 'grid' : 'none';
        const rect = tagMessageInput.getBoundingClientRect();
        suggestionsContainer.style.top = `${rect.top - suggestionsContainer.offsetHeight - 5}px`; // Position above with a small gap
        suggestionsContainer.style.left = `${rect.left}px`;
        suggestionsContainer.style.width = `${rect.width}px`;


        suggestionsContainer.style.display = filteredUsers.length ? 'grid' : 'none';
    } else {
        suggestionsContainer.replaceChildren();
        suggestionsContainer.style.display = 'none';
    }
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
document.addEventListener('DOMContentLoaded', () => {
    // Open the suggestions modal
    document.getElementById('open-suggestions-modal').addEventListener('click', () => {
        const modal = document.getElementById('suggestions-modal');
        modal.style.display = 'flex';
        modal.removeAttribute('inert'); // Remove inert when opening
    });

    // Close the suggestions modal
    document.getElementById('close-suggestions-modal').addEventListener('click', () => {
        const modal = document.getElementById('suggestions-modal');
        modal.style.display = 'none';
        modal.setAttribute('inert', ''); // Add inert when closing
    });

    // Close the modal when clicking outside of it
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('suggestions-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
            modal.setAttribute('inert', ''); // Add inert when closing
        }
    });
});

// Function to update the user's bio
function updateUserBio(newBio) {
    if (currentUser) {
        db.collection('users').doc(currentUser.uid).update({
            bio: newBio
        }).then(() => {
            console.log("Bio updated successfully.");
            document.getElementById('bio-input').value = newBio;
            window.LyriaUI.notify('Bio updated.', 'success');
        }).catch(error => {
            console.error("Error updating bio:", error);
            window.LyriaUI.notify('Failed to update bio.');
        });
    }
}

// Event listener for the bio update button
document.getElementById('update-bio-btn').addEventListener('click', () => {
    const newBio = document.getElementById('bio-input').value.trim();
    if (newBio) {
        updateUserBio(newBio);
    } else {
        window.LyriaUI.notify('Bio cannot be empty.');
    }
});

});


