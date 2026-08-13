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
let unsubscribeFromMessages = null; // Unsubscribe function for message listener
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

    window.addEventListener('resize', () => setMobileMenuOpen(false));
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
    // Event listeners for modal buttons
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'flex';
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'none';
    });

    // Close Profile Modal
    document.getElementById('close-profile-modal').addEventListener('click', () => {
        document.getElementById('profile-modal').style.display = 'none';
    });

    // Close Profile Modal when clicking backdrop
    document.querySelector('.modal-backdrop').addEventListener('click', () => {
        document.getElementById('profile-modal').style.display = 'none';
    });

    // Toggle Dark Mode
    document.getElementById('toggle-dark-mode').addEventListener('click', () => {
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
                alert('Display name updated successfully!');
            }).catch(error => {
                console.error("Error updating display name:", error);
                alert('Failed to update display name');
            });
        }
    });

    // Toggle Notifications
    document.getElementById('notifications-toggle').addEventListener('change', (e) => {
        notificationsEnabled = e.target.checked;
        if(notificationsEnabled) {
            Notification.requestPermission().then(permission => {
                if(permission !== 'granted') {
                    alert('Notifications permission denied.');
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

    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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

    // Copy join code
    document.getElementById('copy-join-code').addEventListener('click', async () => {
        try {
            const doc = await db.collection('channels').doc(currentChannel).get();
            if (doc.exists) {
                const joinCode = doc.data().joinCode;
                const tempInput = document.createElement('input');
                tempInput.value = joinCode;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                alert('Join code copied to clipboard: ' + joinCode);
            } else {
                alert('Channel does not exist.');
            }
        } catch (error) {
            console.error("Error copying join code:", error);
            alert('Failed to copy join code.');
        }
    });
}

function userDocRefForCurrentUser() {
    return db.collection('users').doc(currentUser.uid);
}

function sendMessage(messageText, isCode = false) {
    const messageInput = document.getElementById('message-input');
    
    // Check if messageText is defined and not null
    if (typeof messageText !== 'string' || messageText.trim() === '') {
        console.error("Message text is undefined or not a string.");
        return; // Exit the function if messageText is invalid
    }

    // Format the message as code if isCode is true
    const message = isCode ? `<pre><code>${escapeHtml(messageText)}</code></pre>` : messageText.trim();

    if (message && currentChannel) {
        db.collection('channels').doc(currentChannel)
            .collection('messages').add({
                message: message,
                sender: currentUser.displayName || 'User',
                senderId: currentUser.uid,
                senderPhotoURL: currentUser.photoURL || 'assets/icon.png',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                messageInput.value = ''; // Clear the input after sending
                setTypingStatus(false);
            }).catch(error => {
                console.error("Error sending message:", error);
                alert('Failed to send message.');
            });
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
    const typingStatusContainer = document.getElementById('typing-status');
    if (!typingStatusContainer) {
        console.error("Typing status container not found in HTML.");
        return;
    }

    const typingRef = db.collection('channels').doc(channelId)
        .collection('typingStatus');

    typingRef.onSnapshot(snapshot => {
        const typingUsers = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentUser.uid) {
                typingUsers.push(doc.data().displayName);
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
                    button.textContent = `#${channel.name}`;
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
                    favoriteButton.innerHTML = channel.favorite ? '★' : '☆';
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
    console.log('loadMessages called with channelId:', channelId);

    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
        unsubscribeFromMessages = null;
    }

    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    const channelTitle = document.getElementById('channel-title');

    db.collection('channels').doc(channelId).get().then(doc => {
        if (doc.exists) {
            const channelName = doc.data().name;
            channelTitle.textContent = `#${channelName}`;
            document.getElementById('message-input').placeholder = `Message #${channelName}`;
        }
    }).catch(error => {
        console.error("Error fetching channel data:", error);
        alert('Failed to fetch channel data.');
    });

    unsubscribeFromMessages = db.collection('channels').doc(channelId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snapshot => {
            messagesContainer.innerHTML = '';

            snapshot.forEach(doc => {
                const message = doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = 'message';

                const senderElement = document.createElement('div');
                senderElement.className = 'sender';

                const senderAvatarElement = document.createElement('img');
                senderAvatarElement.src = message.senderPhotoURL || 'assets/icon.png';
                senderAvatarElement.className = message.senderId ? 'sender-avatar' : 'sender-avatar system-avatar';
                senderAvatarElement.width = 34;
                senderAvatarElement.height = 34;
                senderAvatarElement.alt = message.senderId ? `${message.sender || 'User'} avatar` : 'LYRIA';
                if (message.senderId) {
                    senderAvatarElement.setAttribute('data-uid', message.senderId);
                    senderAvatarElement.addEventListener('click', () => {
                        showUserProfileModal(message.senderId);
                    });
                }
                senderElement.appendChild(senderAvatarElement);

                const senderNameElement = document.createElement('span');
                senderNameElement.className = 'sender-name';
                senderNameElement.textContent = message.sender;
                if (message.senderId) {
                    senderNameElement.setAttribute('data-uid', message.senderId);
                    senderNameElement.addEventListener('click', () => {
                        showUserProfileModal(message.senderId);
                    });
                }
                senderElement.appendChild(senderNameElement);

                // Check if the sender has any badges
                const userDocRef = message.senderId ? db.collection('users').doc(message.senderId) : null;
                const userLookup = userDocRef ? userDocRef.get() : Promise.resolve({ exists: false });
                userLookup.then(userDoc => {
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        console.log(`User data for ${message.senderId}:`, userData); // Debugging log

                        // Check for badges
                        if (userData.badges && Array.isArray(userData.badges)) {
                            userData.badges.forEach(badge => {
                                const badgeElement = document.createElement('img');
                                badgeElement.src = `assets/${badge}.png`; // Ensure this path is correct
                                badgeElement.alt = `${badge} Badge`;
                                badgeElement.className = 'admin-badge'; // Use the same class for styling
                                badgeElement.width = 18;
                                badgeElement.height = 18;
                                senderElement.appendChild(badgeElement); // Append badge to the sender element
                            });
                        }

                        // Check if the sender has the feature badge
                        if (featureUserUIDs.includes(message.senderId)) {
                            const featureBadge = document.createElement('img');
                            featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                            featureBadge.alt = 'Feature Badge';
                            featureBadge.className = 'admin-badge'; // Use the same class for styling
                            featureBadge.width = 18;
                            featureBadge.height = 18;
                            senderElement.appendChild(featureBadge); // Append feature badge to the sender element
                        }
                    } else {
                        console.log(`No user data found for ${message.senderId}`); // Debugging log
                    }

                    // Create and append timestamp **after badges**
                    const timestampElement = document.createElement('span');
                    timestampElement.className = 'message-timestamp';
                    const timestamp = message.timestamp ? message.timestamp.toDate() : new Date();
                    const now = new Date();
                    const timeDiff = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24)); // Difference in days

                    let timeString;

                    if (timeDiff < 1) {
                        // Less than a day ago, show time
                        const options = { hour: '2-digit', minute: '2-digit', hour12: true };
                        const time = timestamp.toLocaleTimeString([], options); // Format time
                        timeString = `Today at ${time}`; // e.g., "Today at 3:45 PM"
                    } else if (timeDiff === 1) {
                        // 1 day ago
                        timeString = 'Yesterday';
                    } else if (timeDiff < 7) {
                        // Less than a week ago
                        timeString = `${timeDiff} days ago`;
                    } else {
                        // More than a week ago, show the day of the week
                        const options = { weekday: 'long' };
                        timeString = timestamp.toLocaleDateString(undefined, options); // e.g., "Tuesday"
                    }

                    timestampElement.textContent = timeString;
                    senderElement.appendChild(timestampElement);
                }).catch(error => {
                    console.error("Error fetching user data:", error);
                });

                const messageContentElement = document.createElement('div');
                messageContentElement.className = 'message-content';
                if (message.type === 'gif' && (message.content || message.message)) {
                    const gif = document.createElement('img');
                    gif.src = message.content || message.message;
                    gif.alt = 'Shared GIF';
                    gif.loading = 'lazy';
                    messageContentElement.appendChild(gif);
                } else {
                    messageContentElement.textContent = message.message || message.content || '';
                }

                messageElement.appendChild(senderElement);
                messageElement.appendChild(messageContentElement);

                messagesContainer.appendChild(messageElement);
            });

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, error => {
            console.error("Error loading messages:", error);
            alert('Failed to load messages.');
        });
}
function applyDarkMode() {
    if(darkMode) {
        document.documentElement.style.setProperty('--primary-color', '#1a1a1a');
        document.documentElement.style.setProperty('--background-color', '#121212');
    } else {
        document.documentElement.style.setProperty('--primary-color', '#36393f');
        document.documentElement.style.setProperty('--background-color', '#2f3136');
    }
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Error logging out:", error);
        alert('Failed to log out.');
    });
}

// Function to switch channels
function switchChannel(channelId) {
    if (currentChannel && currentChannel !== channelId && typeof window.leaveCurrentCall === 'function') {
        window.leaveCurrentCall();
    }
    currentChannel = channelId; // Update currentChannel when switching channels
    const leaveButton = document.getElementById('leave-channel');
    if (leaveButton && currentUser) {
        const isPersonalChannel = channelId === `personal-${currentUser.uid}`;
        leaveButton.disabled = isPersonalChannel;
        leaveButton.textContent = isPersonalChannel ? 'Personal channel' : 'Leave conversation';
        leaveButton.title = isPersonalChannel ? 'Your personal channel always stays with your account.' : 'Leave this conversation';
    }
    loadMessages(channelId);     // Load messages for the new channel
    listenForTypingStatus(channelId); // Listen for typing status changes
    if (typeof window.setupCallListeners === 'function') window.setupCallListeners();
}

// Function to open the modal
function openModal() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Disable background scrolling

    // Trap focus within the modal
    trapFocus(modal);

    // Focus the first focusable element in the modal
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
}

// Function to close the modal
function closeModal() {
    const modal = document.getElementById('settings-modal');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'auto'; // Re-enable background scrolling
}

// Function to trap focus within the modal
function trapFocus(modal) {
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', function(e) {
        const isTabPressed = (e.key === 'Tab' || e.keyCode === 9);
        if (!isTabPressed) return;

        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else { // Tab
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    });
}

// Event listener to open the modal when settings button is clicked
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', openModal);
}

// Event listeners to close the modal when close button is clicked
const closeModalBtn = document.getElementById('close-modal');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}

// Event listener to close the modal when clicking outside the modal content
window.addEventListener('click', (event) => {
    const modal = document.getElementById('settings-modal');
    if (event.target === modal) {
        closeModal();
    }
});

// Event listener to close the modal with the Escape key
window.addEventListener('keydown', (event) => {
    const modal = document.getElementById('settings-modal');
    if (event.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
    }
});

const userAvatar = document.getElementById('user-avatar');
if (userAvatar) {
    userAvatar.addEventListener('click', () => {
        showUserProfileModal(currentUser ? currentUser.uid : null);
    });
} else {
    console.error("User avatar element not found.");
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
    profileUserId = uid; // Set the profileUserId to the ID of the user being viewed

    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();
            document.getElementById('profile-modal-image').src = userData.photoURL || 'assets/icon.png';
            document.getElementById('profile-modal-name').textContent = userData.displayName || 'User';

            const profileBadges = document.getElementById('profile-modal-badges');
            profileBadges.innerHTML = ''; // Clear previous badges

            // Check if the user has any badges
            if (userData.badges && Array.isArray(userData.badges)) {
                userData.badges.forEach(badge => {
                    const badgeDiv = document.createElement('div');
                    badgeDiv.className = 'badge';
                    badgeDiv.setAttribute('data-badge-name', badge);
                    
                    // Set the click event to show badge details
                    badgeDiv.onclick = () => {
                        const details = badgeDetails[badge];
                        if (details) {
                            showBadgePreview(badge, details.description, details.userCount);
                        }
                    };

                    const badgeImage = document.createElement('img');
                    badgeImage.src = `assets/${badge}.png`; // Assuming badge images are stored in assets
                    badgeImage.alt = `${badge} Badge`;
                    badgeImage.className = 'badge-image';
                    badgeImage.width = 28;
                    badgeImage.height = 28;

                    const tooltip = document.createElement('span');
                    tooltip.className = 'tooltip';
                    tooltip.textContent = badge; // Show badge name in tooltip

                    badgeDiv.appendChild(badgeImage);
                    badgeDiv.appendChild(tooltip);
                    profileBadges.appendChild(badgeDiv);
                });
            }

            // Check if the user has the feature badge
            if (featureUserUIDs.includes(uid)) {
                const featureBadge = document.createElement('img');
                featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                featureBadge.alt = 'Feature Badge';
                featureBadge.className = 'admin-badge'; // Use the same class for styling
                featureBadge.width = 28;
                featureBadge.height = 28;
                profileBadges.appendChild(featureBadge); // Append feature badge to the profile badges
            }

            // Show the friend request button if the user is not the current user
            const currentUser = firebase.auth().currentUser;
            const sendFriendRequestBtn = document.getElementById('send-friend-request');

            if (currentUser && currentUser.uid !== uid) {
                sendFriendRequestBtn.style.display = 'block'; // Show the button
            } else {
                sendFriendRequestBtn.style.display = 'none'; // Hide the button if it's the same user
            }

            document.getElementById('profile-modal').style.display = 'block';
        }
    }).catch(error => {
        console.error("Error fetching user data:", error);
        alert('Failed to fetch user profile.');
    });
}

// Add friend request functionality
document.getElementById('send-friend-request').addEventListener('click', async () => {
    const currentUser = firebase.auth().currentUser; // Get the current user
    if (!currentUser || !profileUserId) {
        console.error("Missing user information");
        alert('Unable to send friend request - missing user information');
        return; // Exit if user information is missing
    }

    console.log("Current User:", currentUser.uid);
    console.log("Profile User:", profileUserId);
    
    // Check if sending request to self
    if (currentUser.uid === profileUserId) {
        alert('You cannot send a friend request to yourself');
        return;
    }

    // Check if already friends
    const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
    const currentUserData = currentUserDoc.data();
    if (currentUserData.friends && currentUserData.friends.includes(profileUserId)) {
        alert('You are already friends with this user');
        return;
    }

    // Check if request already sent
    const existingRequest = await db.collection('friendRequests')
        .where('from', '==', currentUser.uid)
        .where('to', '==', profileUserId)
        .where('status', '==', 'pending')
        .get();

    if (!existingRequest.empty) {
        alert('You have already sent a friend request to this user');
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

    alert('Friend request sent successfully!');
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
document.body.appendChild(suggestionsContainer); // Append to body or a specific container

tagMessageInput.addEventListener('input', (e) => {
    const value = e.target.value;
    const atIndex = value.lastIndexOf('@');

    if (atIndex !== -1) {
        const query = value.substring(atIndex + 1).toLowerCase();
        const filteredUsers = usersList.filter(user => user.displayName.toLowerCase().includes(query));

        // Clear previous suggestions
        suggestionsContainer.innerHTML = '';

        // Show suggestions
        filteredUsers.forEach(user => {
            const suggestionItem = document.createElement('div');
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
        const rect = tagMessageInput.getBoundingClientRect();
        suggestionsContainer.style.top = `${rect.top - suggestionsContainer.offsetHeight - 5}px`; // Position above with a small gap
        suggestionsContainer.style.left = `${rect.left}px`;
        suggestionsContainer.style.width = `${rect.width}px`;


        suggestionsContainer.style.display = 'block'; // Show suggestions
    } else {
        suggestionsContainer.innerHTML = ''; // Clear suggestions if no @
    }
});

document.getElementById('close-mobile-message').addEventListener('click', () => {
    const mobileMessage = document.getElementById('mobile-message');
    mobileMessage.style.display = 'none';
});

// Detect if the user is on a mobile device
function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
}

// Display the mobile message if on a mobile device
window.addEventListener('load', () => {
    const mobileMessage = document.getElementById('mobile-message');
    if (isMobileDevice()) {
        mobileMessage.style.display = 'block';
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
            alert('Failed to update favorite status.');
        });
    } else {
        // Remove the channel ID from the user's favorite channels
        userDocRef.update({
            favoriteChannels: firebase.firestore.FieldValue.arrayRemove(channelId)
        }).then(() => {
            loadChannels(); // Reload channels to reflect changes
        }).catch(error => {
            console.error("Error removing favorite channel:", error);
            alert('Failed to update favorite status.');
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
            document.getElementById('bio-input').value = newBio; // Update the input field with the new bio
        }).catch(error => {
            console.error("Error updating bio:", error);
            alert('Failed to update bio.');
        });
    }
}

// Event listener for the bio update button
document.getElementById('update-bio-btn').addEventListener('click', () => {
    const newBio = document.getElementById('bio-input').value.trim();
    if (newBio) {
        updateUserBio(newBio);
    } else {
        alert('Bio cannot be empty.');
    }
});

});

