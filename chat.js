function setupMessageListener() {
    const channelTitle = document.getElementById('channel-title').textContent.replace('# ', '');
    console.log('Setting up message listener for channel:', channelTitle);

    // Clear existing messages first
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = ''; // Clear previous messages
    }

    // Set up real-time listener for messages in the specific channel
    return db.collection('channels').doc(channelTitle).collection('messages')
        .orderBy('timestamp', 'asc')  // Ensure messages are in order
        .onSnapshot((snapshot) => {
            console.log('Received snapshot with changes');
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    console.log('Processing message:', message); // Log the message being processed
                    displayMessage(message);
                }
            });
        }, (error) => {
            console.error('Error in message listener:', error);
        });
}
// Use the configured Firebase instances from config.js
let auth, db;

// Wait for Firebase to be initialized
const initializeFirebase = async () => {
    if (window.firebaseConfig) {
        try {
            await window.firebaseConfig.initialize();
            auth = window.firebaseConfig.getAuth();
            db = window.firebaseConfig.getFirestore();
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

const betaUserUIDs = [
    "DWjEGCFvdKe50fMiXk9EsHH9j3F3", // Replace with actual user ID
    "RshQJzHL4tUt34Jqgd96g0DktHk2", // Replace with actual user ID
    // Add more user IDs as needed
];

const featureUserUIDs = ["miu0tI2oHJUiNx2gxtPwSpJ136w1", "dIc6q6xdqsTuiVC9JWGQT9XVH6T2"]; // Add the UID for the feature badge

// Mobile menu toggle functionality
function setupMobileMenu() {
    const headerToggle = document.querySelector('#header-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (!headerToggle || !sidebar) return;
    
    headerToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = sidebar.classList.toggle('open');
        headerToggle.setAttribute('aria-expanded', isOpen.toString());
        
        // Focus management for accessibility
        if (isOpen) {
            const firstFocusable = sidebar.querySelector('button, input, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    });
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
        sidebar.classList.remove('open');
        headerToggle.setAttribute('aria-expanded', 'false');
    }
});

// Initialize Firebase and setup authentication
initializeFirebase().then(() => {
    if (!auth) {
        console.error('Auth not initialized');
        return;
    }

    // Authenticate the user and load settings
    auth.onAuthStateChanged((user) => {
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
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            if (nameEl) nameEl.textContent = userData.displayName;
            if (avatarEl) avatarEl.src = userData.photoURL;

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
                        const welcomeMessage = `Welcome to ${channel.name}, **${currentUser.displayName || 'User'}**! We're glad to have you here.`;
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
        showUserProfileModal(currentUser ? currentUser.uid : null);
    });
} else {
    console.error("User avatar element not found.");
}




// Profile modal click handler moved above



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

// Helper function to setup channel management
function setupChannelManagement() {
    // Add channel button functionality
    const addChannelBtn = document.getElementById('add-channel');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => {
            const channelName = prompt('Enter channel name:');
            if (channelName && window.utils) {
                const sanitizedName = window.utils.sanitizeInput(channelName);
                if (sanitizedName) {
                    createChannel(sanitizedName);
                }
            }
        });
    }
    
    // Join channel button functionality
    const joinChannelBtn = document.getElementById('join-channel');
    if (joinChannelBtn) {
        joinChannelBtn.addEventListener('click', () => {
            const joinCode = prompt('Enter channel join code:');
            if (joinCode && window.utils) {
                const sanitizedCode = window.utils.sanitizeInput(joinCode);
                if (sanitizedCode) {
                    joinChannelByCode(sanitizedCode);
                }
            }
        });
    }
}

// Helper function to setup general chat functionality
function setupChatFunctionality() {
    // Message input handling
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    if (messageInput && sendButton) {
        // Enhanced message sending with validation
        const sendMessage = () => {
            const message = messageInput.value.trim();
            if (message && window.utils) {
                const sanitizedMessage = window.utils.sanitizeInput(message);
                if (sanitizedMessage.length > 0 && sanitizedMessage.length <= 1000) {
                    // Send message logic here
                    messageInput.value = '';
                } else {
                    window.utils.showWarning('Message must be between 1 and 1000 characters');
                }
            }
        };
        
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Setup other event listeners
    setupModalEventListeners();
}

// Helper function to setup modal event listeners
function setupModalEventListeners() {
    // Settings modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
        });
    }
    
    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="flex"]');
            if (openModal) {
                openModal.style.display = 'none';
            }
        }
    });
}

// Placeholder functions for channel operations
function createChannel(name) {
    if (window.utils) {
        window.utils.showInfo(`Creating channel: ${name}`);
        // Implement channel creation logic
    }
}

function joinChannelByCode(code) {
    if (window.utils) {
        window.utils.showInfo(`Joining channel with code: ${code}`);
        // Implement join channel logic
    }
}

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

// Setup authentication state change handler
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        const userId = user.uid;

        // Fetch and display user data
        db.collection('users').doc(userId).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('user-name').textContent = userData.displayName;
                document.getElementById('user-avatar').src = userData.photoURL || 'assets/icon.png';

                // Set bio if available
                if (userData.bio) {
                    document.getElementById('bio-input').value = userData.bio;
                }

                // Check if the user has the premium badge
                const profileBadges = document.getElementById('profile-modal-badges');
                if (profileBadges) {
                    profileBadges.innerHTML = ''; // Clear any existing badges

                    if (userData.badges && userData.badges.includes('premium')) {
                        const premiumBadge = document.createElement('img');
                        premiumBadge.src = 'assets/premium.png';
                        premiumBadge.alt = 'Premium Badge';
                        premiumBadge.className = 'admin-badge';
                        profileBadges.appendChild(premiumBadge);
                    }
                }
            } else {
                console.log("No user document found");
            }
        }).catch(error => {
            console.error("Error getting user document:", error);
        });

        // Setup channel management and chat functionality
        setupChannelManagement();
        setupChatFunctionality();
    } else {
        // User is signed out, redirect to login
        window.location.href = 'login.html';
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

function showBadgeInfo(badgeName) {
    db.collection('badges').doc(badgeName).get().then(doc => {
        if (doc.exists) {
            const badgeData = doc.data();
            const badgeDetails = `
                <h2>${badgeData.name}</h2>
                <p>${badgeData.description}</p>
                <p><strong>Rarity:</strong> ${badgeData.rarity}</p>
                <p><strong>Holders:</strong> ${badgeData.awardedTo.length}</p>
            `;
            const badgeModalContent = document.getElementById('badge-modal-content');
            badgeModalContent.innerHTML = badgeDetails; // Set the modal content
            document.getElementById('badge-modal').style.display = 'block'; // Show the modal
        } else {
            console.error("Badge does not exist.");
        }
    }).catch(error => {
        console.error("Error fetching badge details:", error);
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

async function loadUserProfile(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Update profile modal with user data
        document.getElementById('profile-modal-name').textContent = userData.displayName || 'User Name';
        document.getElementById('profile-modal-bio').textContent = userData.bio || 'COMING SOON';
        
        // Clear existing badges
        const badgesContainer = document.getElementById('profile-modal-badges');
        badgesContainer.innerHTML = ''; // Clear previous badges

        // Loop through user's badges and create badge elements
        userData.badges.forEach(badge => {
            const badgeDiv = document.createElement('div');
            badgeDiv.className = 'badge';
            badgeDiv.setAttribute('data-badge-name', badge); // Set badge name for tooltip
            badgeDiv.onclick = () => showBadgeInfo(badge); // Set click event

            const badgeImage = document.createElement('img');
            badgeImage.src = `assets/${badge}.png`; // Assuming badge images are stored in assets
            badgeImage.alt = `${badge} Badge`;
            badgeImage.className = 'badge-image';

            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip';
            tooltip.textContent = badge; // Set tooltip text

            // Append elements to badgeDiv
            badgeDiv.appendChild(badgeImage);
            badgeDiv.appendChild(tooltip);
            badgesContainer.appendChild(badgeDiv);
        });
    } else {
        console.error("User document does not exist.");
    }
}

document.getElementById('change-background-btn').addEventListener('click', () => {
    const colorPicker = document.getElementById('background-color-picker');
    const imageInput = document.getElementById('background-image-input');

    // Toggle visibility of color picker and image input
    if (colorPicker.style.display === 'none') {
        colorPicker.style.display = 'block';
        imageInput.style.display = 'none';
    } else {
        colorPicker.style.display = 'none';
        imageInput.style.display = 'block';
    }
});

// Change background color
document.getElementById('background-color-picker').addEventListener('input', (event) => {
    const chatArea = document.querySelector('.chat-area');
    chatArea.style.backgroundColor = event.target.value;
});

// Change background image
document.getElementById('background-image-input').addEventListener('change', (event) => {
    const chatArea = document.querySelector('.chat-area');
    const file = event.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            chatArea.style.backgroundImage = `url(${e.target.result})`;
            chatArea.style.backgroundSize = 'cover'; // Optional: Cover the entire area
            chatArea.style.backgroundPosition = 'center'; // Optional: Center the image
        };
        reader.readAsDataURL(file);
    }
});


// In your message listener/handler
// Guarded top-level listener (prevent errors if elements are not yet ready)
if (typeof db !== 'undefined' && typeof currentChannel !== 'undefined') {
    db.collection('messages').where('channelId', '==', currentChannel)
        .orderBy('timestamp')
        .onSnapshot((snapshot) => {
            const messagesContainer = document.getElementById('messages');
            if (!messagesContainer) return;
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    const messageElement = document.createElement('div');
                    // Use the renderMessage function to handle different message types
                    messageElement.innerHTML = renderMessage(message);
                    messagesContainer.appendChild(messageElement);
                    if (typeof scrollToBottom === 'function') {
                        scrollToBottom();
                    }
                }
            });
        });
}

    function displayMessage(message) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) {
            console.error('Messages container not found!');
            return;
        }
    
        console.log('Displaying message:', message); // Log the message being displayed
    
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
    
        if (message.type === 'gif') {
            console.log('Rendering GIF message:', message.content);
            messageElement.innerHTML = `
                <div class="message-header">
                    <strong>${message.displayName || 'Anonymous'}</strong>
                    <span class="timestamp">${message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString() : 'Just now'}</span>
                </div>
                <div class="message-content">
                    <img src="${message.content}" alt="GIF" style="max-width: 300px; max-height: 300px; border-radius: 8px;">
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-header">
                    <strong>${message.displayName || 'Anonymous'}</strong>
                    <span class="timestamp">${message.timestamp ? new Date(message.timestamp.toDate()).toLocaleString() : 'Just now'}</span>
                </div>
                <div class="message-content">
                    ${message.content}
                </div>
            `;
        }
    
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to the bottom
    }

function handleNewMessage(message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';

    if (message.type === 'gif') {
        messageElement.innerHTML = `
            <div class="message-header">
                <strong>${message.displayName}</strong>
                <span class="timestamp">${formatTimestamp(message.timestamp)}</span>
            </div>
            <div class="message-content">
                <img src="${message.content}" alt="GIF" style="max-width: 300px; max-height: 300px; border-radius: 8px;">
            </div>
        `;
    } else {
        // Your existing message rendering code
        messageElement.innerHTML = `
            <div class="message-header">
                <strong>${message.displayName}</strong>
                <span class="timestamp">${formatTimestamp(message.timestamp)}</span>
            </div>
            <div class="message-content">
                ${message.content}
            </div>
        `;
    }

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update your message listener
db.collection('messages')
    .where('channelId', '==', currentChannel)
    .orderBy('timestamp')
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const message = change.doc.data();
                console.log('New message received:', message);
                handleNewMessage(message);
            }
        });
    });

