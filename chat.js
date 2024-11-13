// chat.js

const firebaseConfig = {
    apiKey: "AIzaSyDORsM0Dz9d_ZxqVd8zjNXwsEdR1_aVF7g",
    authDomain: "lyria-cfc06.firebaseapp.com", 
    projectId: "lyria-cfc06",
    storageBucket: "lyria-cfc06.appspot.com",
    messagingSenderId: "309881717815",
    appId: "1:309881717815:web:c8e9a4007341ab17ecebb2",
    measurementId: "G-0EMBBE255Z",
    databaseURL: "https://lyria-cfc06-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser;
let currentChannel;
let darkMode = false;
let notificationsEnabled = false;
let lastMessageTimestamp = null;
let unsubscribeFromMessages = null; // Unsubscribe function for message listener

// Create notification sound
const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Define an array of UIDs for users who should have badges
const badgeUserUIDs = ["qzf9fO2bBLU0PJhRDSQK9KnMZD32", "xLT0XKgtF5ZnlfX2fLj9hXrTcW02"]; // Replace with actual UIDs

// Mobile menu toggle
document.querySelector('.menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('active');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !menuToggle.contains(e.target) &&
        sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
});

// Authenticate the user and load settings
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        const userDocRef = db.collection('users').doc(user.uid);

        userDocRef.get().then(doc => {
            if (!doc.exists) {
                const personalChannelId = `personal-${user.uid}`;
                return Promise.all([
                    userDocRef.set({
                        displayName: user.displayName || 'User',
                        email: user.email,
                        photoURL: user.photoURL || 'assets/default-avatar.png',
                        role: 'user',
                        channels: [`personal-${user.uid}`],
                        darkMode: false,
                        notificationsEnabled: false
                    }),
                    db.collection('channels').doc(personalChannelId).set({
                        name: 'My Personal Channel',
                        id: personalChannelId,
                        createdBy: user.uid,
                        joinCode: generateJoinCode(),
                        members: [user.uid]
                    })
                ]).then(() => userDocRef.get());
            }
            return doc;
        }).then(doc => {
            const userData = doc.exists ? doc.data() : {
                displayName: user.displayName || 'User',
                email: user.email,
                photoURL: user.photoURL || 'assets/default-avatar.png',
                role: 'user',
                channels: [`personal-${user.uid}`],
                darkMode: false,
                notificationsEnabled: false
            };

            // Display user information
            document.getElementById('user-name').textContent = userData.displayName;
            document.getElementById('user-avatar').src = userData.photoURL;

            // Check if the user's UID is in the badgeUserUIDs array
            if (badgeUserUIDs.includes(user.uid)) {
                const badgesContainer = document.createElement('div');
                badgesContainer.className = 'badges-container';

                const badges = ['DevBadge.png', 'Mod.png', 'EarlyAccess.png'];
                badges.forEach(badgeSrc => {
                    const badge = document.createElement('img');
                    badge.src = `assets/${badgeSrc}`;
                    badge.alt = badgeSrc.replace('.png', '') + ' Badge';
                    badge.className = 'admin-badge';
                    badgesContainer.appendChild(badge);
                });

                document.getElementById('user-name').after(badgesContainer);
            }

            darkMode = userData.darkMode;
            notificationsEnabled = userData.notificationsEnabled;
            document.getElementById('notifications-toggle').checked = notificationsEnabled;
            applyDarkMode();

            document.getElementById('add-channel').removeAttribute('disabled');
            document.getElementById('join-channel').removeAttribute('disabled');

            setupUIEventListeners();
            currentChannel = `personal-${user.uid}`;
            loadChannels();

            // Initialize PeerJS after currentUser is available
            // Uncomment the line below if using voicecall.js and initializePeer() is defined
            // initializePeer();
        }).catch(error => {
            console.error("Error handling user data:", error);
        });
    } else {
        window.location.href = 'login.html';
    }
});

function setupUIEventListeners() {
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
        sendMessage();
    });

    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
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

    // Add channel
    document.getElementById('add-channel').addEventListener('click', () => {
        const channelName = prompt('Enter channel name:');
        if (channelName) {
            const channelId = `${Date.now()}-${currentUser.uid}`;
            db.collection('channels').doc(channelId).set({
                name: channelName,
                id: channelId,
                createdBy: currentUser.uid,
                joinCode: generateJoinCode(),
                members: [currentUser.uid]
            }).then(() => {
                loadChannels();
            }).catch(error => {
                console.error("Error creating channel:", error);
                alert('Failed to create channel.');
            });
        }
    });

    // Join channel
    document.getElementById('join-channel').addEventListener('click', () => {
        const joinCode = prompt('Enter channel join code:');
        if (joinCode) {
            db.collection('channels').where('joinCode', '==', joinCode).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const channelDoc = snapshot.docs[0];
                        const channel = channelDoc.data();

                        // Add user to channel members
                        return db.collection('channels').doc(channel.id).update({
                            members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                        }).then(() => {
                            switchChannel(channel.id);
                            loadChannels();
                        });
                    } else {
                        alert('Invalid join code.');
                    }
                }).catch(error => {
                    console.error("Error joining channel:", error);
                    alert('Failed to join channel.');
                });
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

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    if (messageText && currentChannel) {
        db.collection('channels').doc(currentChannel)
            .collection('messages').add({
                message: messageText,
                sender: currentUser.displayName || 'User',
                senderId: currentUser.uid, // Include sender's UID
                senderPhotoURL: currentUser.photoURL || 'assets/default-avatar.png', // Include sender's photo URL
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                messageInput.value = '';
                // Reset typing status
                setTypingStatus(false);
            }).catch(error => {
                console.error("Error sending message:", error);
                alert('Failed to send message.');
            });
    }
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
        snapshot.forEach(doc => {
            const channel = doc.data();
            const channelElement = document.createElement('li');
            const button = document.createElement('button');
            button.className = 'channel-btn';
            button.textContent = `#${channel.name}`;
            button.setAttribute('data-channel-id', channel.id); // Add data attribute
            button.onclick = () => {
                switchChannel(channel.id);
                document.querySelectorAll('.channel-btn').forEach(btn => btn.classList.remove('active-channel'));
                button.classList.add('active-channel');
                document.getElementById('message-input').placeholder = `Message #${channel.name}`;
                // Close sidebar on mobile after channel selection
                if (window.innerWidth <= 768) {
                    document.querySelector('.sidebar').classList.remove('active');
                }
            };
            channelElement.appendChild(button);
            channelsList.appendChild(channelElement);
        });

        // Load messages for the current channel or default to personal channel
        if (!currentChannel) {
            currentChannel = `personal-${currentUser.uid}`;
        }
        switchChannel(currentChannel); // Use switchChannel to load messages and peer ID
    })
    .catch(error => {
        console.error("Error loading channels:", error);
        alert('Failed to load channels.');
    });
}

function generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function loadMessages(channelId) {
    console.log('loadMessages called with channelId:', channelId);

    // Unsubscribe from previous listener if it exists
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

    // Set up the new listener and store the unsubscribe function
    unsubscribeFromMessages = db.collection('channels').doc(channelId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snapshot => {
            messagesContainer.innerHTML = ''; // Clear the container to prevent duplicates

            snapshot.forEach(doc => {
                const message = doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = 'message';

                // Create sender element
                const senderElement = document.createElement('div');
                senderElement.className = 'sender';

                // Sender avatar
                const senderAvatarElement = document.createElement('img');
                senderAvatarElement.src = message.senderPhotoURL || 'assets/default-avatar.png';
                senderAvatarElement.className = 'sender-avatar';
                senderAvatarElement.setAttribute('data-uid', message.senderId);
                senderAvatarElement.addEventListener('click', () => {
                    showUserProfileModal(message.senderId);
                });
                senderElement.appendChild(senderAvatarElement);

                // Sender name
                const senderNameElement = document.createElement('span');
                senderNameElement.className = 'sender-name';
                senderNameElement.textContent = message.sender;
                senderNameElement.setAttribute('data-uid', message.senderId);
                senderNameElement.addEventListener('click', () => {
                    showUserProfileModal(message.senderId);
                });
                senderElement.appendChild(senderNameElement);

                // Check if sender's UID is in the badgeUserUIDs array
                if (message.senderId && badgeUserUIDs.includes(message.senderId)) {
                    console.log('Displaying badges for senderId:', message.senderId);
                    const badgesContainer = document.createElement('span');
                    badgesContainer.className = 'badges-container';

                    const badges = ['DevBadge.png', 'Mod.png', 'EarlyAccess.png'];
                    badges.forEach(badgeSrc => {
                        const badge = document.createElement('img');
                        badge.src = `assets/${badgeSrc}`;
                        badge.alt = badgeSrc.replace('.png', '') + ' Badge';
                        badge.className = 'admin-badge';
                        badgesContainer.appendChild(badge);
                    });

                    senderElement.appendChild(badgesContainer);
                }

                // Timestamp
                const timestampElement = document.createElement('span');
                timestampElement.className = 'message-timestamp';
                const timestamp = message.timestamp ? message.timestamp.toDate() : new Date();
                const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timestampElement.textContent = timeString;
                senderElement.appendChild(timestampElement);

                // Message content
                const messageContentElement = document.createElement('div');
                messageContentElement.className = 'message-content';
                messageContentElement.textContent = message.message;

                // Apply moving color theme if sender is in badgeUserUIDs
                if (message.senderId && badgeUserUIDs.includes(message.senderId)) {
                    messageContentElement.classList.add('moving-color');
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

function showUserProfileModal(uid) {
    // Fetch user data from Firestore
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists) {
            const userData = doc.data();

            // Set profile image
            const profileImage = document.getElementById('profile-modal-image');
            if (profileImage) {
                profileImage.src = userData.photoURL || 'assets/default-avatar.png';
            } else {
                console.error("Profile modal image element not found.");
            }

            // Set display name
            const profileName = document.getElementById('profile-modal-name');
            if (profileName) {
                profileName.textContent = userData.displayName || 'User';
            } else {
                console.error("Profile modal name element not found.");
            }

            // Set badges
            const profileBadges = document.getElementById('profile-modal-badges');
            if (profileBadges) {
                profileBadges.innerHTML = ''; // Clear previous badges

                if (badgeUserUIDs.includes(uid)) {
                    const badges = ['admin.png','DevBadge.png', 'Mod.png', 'EarlyAccess.png'];
                    badges.forEach(badgeSrc => {
                        const badge = document.createElement('img');
                        badge.src = `assets/${badgeSrc}`;
                        badge.alt = badgeSrc.replace('.png', '') + ' Badge';
                        badge.className = 'admin-badge';
                        profileBadges.appendChild(badge);
                    });
                }
            } else {
                console.error("Profile modal badges element not found.");
            }

            // Display the modal
            const profileModal = document.getElementById('profile-modal');
            if (profileModal) {
                profileModal.style.display = 'flex';
            } else {
                console.error("Profile modal element not found.");
            }
        } else {
            console.error('User data not found');
            alert('User profile not found.');
        }
    }).catch(error => {
        console.error('Error fetching user data:', error);
        alert('Failed to fetch user profile.');
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
    currentChannel = channelId; // Update currentChannel when switching channels
    loadMessages(channelId);     // Load messages for the new channel
    listenForTypingStatus(channelId); // Listen for typing status changes
    // Uncomment the line below if using voicecall.js and initializePeer() is defined
    // loadChannelPeerId(channelId); // Load and set currentChannelPeerId (from voicecall.js)
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
        // Directly open the modal for testing
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            profileModal.style.display = 'flex';
        } else {
            console.error("Profile modal element not found.");
        }
    });
} else {
    console.error("User avatar element not found.");
}


function showUserProfileModal(uid) {
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        // Display the modal directly for testing
        profileModal.style.display = 'flex';
        console.log("Profile modal opened for UID:", uid);
    } else {
        console.error("Profile modal element not found.");
    }
}

userAvatar.addEventListener('click', () => {
    showUserProfileModal(currentUser ? currentUser.uid : null);
});

