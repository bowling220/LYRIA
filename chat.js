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

const betaUserUIDs = [
    "DWjEGCFvdKe50fMiXk9EsHH9j3F3", // Replace with actual user ID
    "RshQJzHL4tUt34Jqgd96g0DktHk2", // Replace with actual user ID
    // Add more user IDs as needed
];

const featureUserUIDs = ["miu0tI2oHJUiNx2gxtPwSpJ136w1", "dIc6q6xdqsTuiVC9JWGQT9XVH6T2"]; // Add the UID for the feature badge

document.querySelector('#sidebar-menu-toggle').addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent event from bubbling up
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
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
                        photoURL: user.photoURL || 'assets/icon.png',
                        role: 'user',
                        channels: [`personal-${user.uid}`],
                        darkMode: false,
                        notificationsEnabled: false,
                        bio: "No bio set." // Set the default bio
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
                photoURL: user.photoURL || 'assets/icon.png',
                role: 'user',
                channels: [`personal-${user.uid}`],
                darkMode: false,
                notificationsEnabled: false,
                bio: "No bio set." // Set the default bio
            };

            // Display user information
            document.getElementById('user-name').textContent = userData.displayName;
            document.getElementById('user-avatar').src = userData.photoURL;

            // Check if the user's UID is in the badgeUserUIDs array
            if (badgeUserUIDs.includes(user.uid)) {
                // Commenting out the badge display logic
                /*
                const badgesContainer = document.createElement('div');
                badgesContainer.className = 'badges-container';
                const badges = ['admin.png', 'DevBadge.png', 'Mod.png', 'EarlyAccess.png'];
                badges.forEach(badgeSrc => {
                    const badge = document.createElement('img');
                    badge.src = `assets/${badgeSrc}`;
                    badge.alt = badgeSrc.replace('.png', '') + ' Badge';
                    badge.className = 'admin-badge';
                    badgesContainer.appendChild(badge);
                });
                document.getElementById('user-name').after(badgesContainer);
                */
            }

            // Check if the user's UID is in the featureUserUIDs array
            if (featureUserUIDs.includes(user.uid)) {
                const featureBadge = document.createElement('img');
                featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                featureBadge.alt = 'Feature Badge';
                featureBadge.className = 'admin-badge'; // Use the same class for styling as admin badges
                document.getElementById('user-name').after(featureBadge); // Display the badge after the user name
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
    let isCreatingChannel = false; // Flag to prevent multiple submissions

    document.getElementById('add-channel').addEventListener('click', () => {
        if (isCreatingChannel) return; // Prevent further clicks if already creating a channel

        const channelName = prompt('Enter channel name:');
        if (channelName) {
            // Check if the channel already exists
            db.collection('channels').where('name', '==', channelName).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        alert('A channel with this name already exists.');
                        return; // Exit if a duplicate is found
                    }

                    const channelId = `${Date.now()}-${currentUser.uid}`;
                    console.log('Creating channel with name:', channelName, 'and ID:', channelId); // Debugging log

                    // Set the flag to true to indicate a channel creation is in progress
                    isCreatingChannel = true;

                    return db.collection('channels').doc(channelId).set({
                        name: channelName,
                        id: channelId,
                        createdBy: currentUser.uid,
                        joinCode: generateJoinCode(),
                        members: [currentUser.uid], // Ensure the creator is added as a member
                        isPublic: false, // Set to true if you want the channel to be public
                        favorite: false // Default to not favorite
                    }).then(() => {
                        // Send a welcoming message to the new channel with more words
                        return db.collection('channels').doc(channelId).collection('messages').add({
                            message: `Welcome to ${channelName}, ${currentUser.displayName || 'User'}! This is a new channel created by ${currentUser.displayName || 'User'}. Let's start chatting!`,
                            sender: 'System',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                }).then(() => {
                    loadChannels(); // Reload channels after creation
                }).catch(error => {
                    console.error("Error creating channel:", error);
                    alert('Failed to create channel.');
                }).finally(() => {
                    // Reset the flag and re-enable the button after the operation is complete
                    isCreatingChannel = false;
                });
        }
    });
// Join channel
document.getElementById('join-channel').addEventListener('click', () => {
    console.log('Join channel button clicked'); // Log to confirm the button click
    const joinCode = prompt('Enter channel join code:');
    if (joinCode) {
        db.collection('channels').where('joinCode', '==', joinCode).get()
            .then(snapshot => {
                console.log(`Join code entered: ${joinCode}`); // Log the join code
                console.log(`Channels found: ${snapshot.size}`); // Log the number of channels found
                if (!snapshot.empty) {
                    const channelDoc = snapshot.docs[0];
                    const channel = channelDoc.data();

                    console.log(`Joining channel: ${channel.name}`); // Log channel name

                    // Add user to channel members
                    return db.collection('channels').doc(channel.id).update({
                        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                    }).then(() => {
                        console.log(`User ${currentUser.displayName} added to channel ${channel.name}`); // Log user addition

                        // Send a welcome message to the channel
                        const welcomeMessage = `Welcome to ${channel.name}, ${currentUser.displayName || 'User'}! We're glad to have you here.`;
                        return db.collection('channels').doc(channel.id).collection('messages').add({
                            message: welcomeMessage,
                            sender: 'System',
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }).then(() => {
                        console.log(`Welcome message sent to channel ${channel.name}`); // Log message sending
                        switchChannel(channel.id);
                        loadChannels();
                    });
                } else {
                    alert('Invalid join code.');
                }
            }).catch(error => {
                console.error("Error joining channel:", error); // Log any errors
                alert('Failed to join channel.');
            });
    }
});    // Leave channel
    document.getElementById('leave-channel').addEventListener('click', () => {
        if (currentChannel) {
            db.collection('channels').doc(currentChannel).update({
                members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            }).then(() => {
                switchChannel(`personal-${currentUser.uid}`);
                loadChannels();
            }).catch(error => {
                console.error("Error leaving channel:", error);
                alert('Failed to leave channel.');
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
                senderPhotoURL: currentUser.photoURL || 'assets/icon.png', // Include sender's photo URL
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
                            document.querySelector('.sidebar').classList.remove('active');
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
                senderAvatarElement.className = 'sender-avatar';
                senderAvatarElement.setAttribute('data-uid', message.senderId);
                senderAvatarElement.addEventListener('click', () => {
                    showUserProfileModal(message.senderId);
                });
                senderElement.appendChild(senderAvatarElement);

                const senderNameElement = document.createElement('span');
                senderNameElement.className = 'sender-name';
                senderNameElement.textContent = message.sender;
                senderNameElement.setAttribute('data-uid', message.senderId);
                senderNameElement.addEventListener('click', () => {
                    showUserProfileModal(message.senderId);
                });
                senderElement.appendChild(senderNameElement);

                // Check if the sender has any badges
                const userDocRef = db.collection('users').doc(message.senderId);
                userDocRef.get().then(userDoc => {
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
                                senderElement.appendChild(badgeElement); // Append badge to the sender element
                            });
                        }

                        // Check if the sender has the feature badge
                        if (featureUserUIDs.includes(message.senderId)) {
                            const featureBadge = document.createElement('img');
                            featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                            featureBadge.alt = 'Feature Badge';
                            featureBadge.className = 'admin-badge'; // Use the same class for styling
                            senderElement.appendChild(featureBadge); // Append feature badge to the sender element
                        }
                    } else {
                        console.log(`No user data found for ${message.senderId}`); // Debugging log
                    }

                    // Create and append timestamp **after badges**
                    const timestampElement = document.createElement('span');
                    timestampElement.className = 'message-timestamp';
                    const timestamp = message.timestamp ? message.timestamp.toDate() : new Date();
                    const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    timestampElement.textContent = timeString;
                    senderElement.appendChild(timestampElement);
                }).catch(error => {
                    console.error("Error fetching user data:", error);
                });

                const messageContentElement = document.createElement('div');
                messageContentElement.className = 'message-content';
                messageContentElement.textContent = message.message;

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




userAvatar.addEventListener('click', () => {
    showUserProfileModal(currentUser ? currentUser.uid : null);
});



let showBadges = true; // Default value for showing badges

// Function to load settings, including badge visibility
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        const userDocRef = db.collection('users').doc(user.uid);

        userDocRef.get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                showBadges = userData.showBadges !== false; // Default to true if not set

                // Display badge visibility toggle if the user has the admin badge
                if (badgeUserUIDs.includes(user.uid)) {
                    document.getElementById('badge-visibility-section').style.display = 'block';
                    document.getElementById('badge-visibility-toggle').checked = showBadges;
                }

                // Update badge visibility
                applyBadgeVisibility();
            }
        }).catch(error => {
            console.error("Error loading user data:", error);
        });
    }
});

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
                    const badgeElement = document.createElement('img');
                    badgeElement.src = `assets/${badge}.png`; // Ensure this path is correct
                    badgeElement.alt = `${badge} Badge`;
                    badgeElement.className = 'admin-badge';
                    profileBadges.appendChild(badgeElement); // Append badge to the profile badges
                });
            }

            // Check if the user has the feature badge
            if (featureUserUIDs.includes(uid)) {
                const featureBadge = document.createElement('img');
                featureBadge.src = 'assets/feature.png'; // Path to the feature badge
                featureBadge.alt = 'Feature Badge';
                featureBadge.className = 'admin-badge'; // Use the same class for styling
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

            document.getElementById('profile-modal').style.display = 'flex';
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
const messageInput = document.getElementById('message-input');
const suggestionsContainer = document.createElement('div');
suggestionsContainer.className = 'suggestions-container';
document.body.appendChild(suggestionsContainer); // Append to body or a specific container

messageInput.addEventListener('input', (e) => {
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
                messageInput.value = newMessage;
                suggestionsContainer.innerHTML = ''; // Clear suggestions
                messageInput.focus(); // Refocus on input
            };
            suggestionsContainer.appendChild(suggestionItem);
        });

        // Position the suggestions container above the message input
        const rect = messageInput.getBoundingClientRect();
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

// Assuming you have already initialized Firebase and authenticated the user
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        const userId = user.uid;
        const userDocRef = db.collection('users').doc(userId);

        // Fetch and display user data
        userDocRef.get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('user-name').textContent = userData.displayName;
                document.getElementById('user-avatar').src = userData.photoURL || 'assets/icon.png';
                document.getElementById('bio-input').value = userData.bio || "No bio set."; // Set the current user's bio

                // Check if the user has the premium badge
                const profileBadges = document.getElementById('profile-modal-badges');
                profileBadges.innerHTML = ''; // Clear any existing badges

                if (userData.badges && userData.badges.includes('Premium')) {
                    console.log("User has premium badge, adding badge."); // Debugging log
                    const premiumBadge = document.createElement('img');
                    premiumBadge.src = 'assets/premium.png'; // Path to the premium badge
                    premiumBadge.alt = 'Premium Badge';
                    premiumBadge.className = 'admin-badge'; // Use the same class for styling
                    profileBadges.appendChild(premiumBadge); // Append premium badge to the profile badges
                } else {
                    console.log("User does not have the premium badge."); // Debugging log
                }
            } else {
                console.log("No such document for the user.");
            }
        }).catch(error => {
            console.error("Error fetching user document:", error);
        });
    }
});

function assignAllBadgesToUser(userId) {
    const badges = ['admin', 'DevBadge', 'Mod', 'EarlyAccess']; // List of all badges you want to assign
    const userDocRef = db.collection('users').doc(userId);
    
    userDocRef.update({
        badges: firebase.firestore.FieldValue.arrayUnion(...badges) // Add all badges to the array
    }).then(() => {
        console.log(`All badges assigned to user ${userId}`);
    }).catch(error => {
        console.error("Error assigning badges:", error);
    });
} // Close the function properly
assignAllBadgesToUser('qzf9fO2bBLU0PJhRDSQK9KnMZD32', 'xLT0XKgtF5ZnlfX2fLj9hXrTcW02');

function assignBetaBadgeToUser(userId) {
    const badge = 'Beta'; // Define the Beta badge
    const userDocRef = db.collection('users').doc(userId);
    
    userDocRef.update({
        badges: firebase.firestore.FieldValue.arrayUnion(badge) // Add the Beta badge to the array
    }).then(() => {
        console.log(`Beta badge assigned to user ${userId}`);
    }).catch(error => {
        console.error("Error assigning Beta badge:", error);
    });
}

betaUserUIDs.forEach(userId => {
    assignBetaBadgeToUser(userId);
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

function loadUsers() {
    db.collection('users').get().then(snapshot => {
        const usersList = document.getElementById('users-list'); // Assuming you have a list element
        usersList.innerHTML = ''; // Clear previous content

        snapshot.forEach(doc => {
            const userData = doc.data();
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${userData.displayName}</span>
                <span>${userData.bio}</span> <!-- Display the correct bio for each user -->
            `;
            usersList.appendChild(listItem);
        });
    }).catch(error => {
        console.error("Error loading users:", error);
    });
}

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