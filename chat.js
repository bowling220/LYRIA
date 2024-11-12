// chat.js

// Firebase configuration
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

// User color preferences
let userColors = {
    primaryColor: '#36393f',
    backgroundColor: '#2f3136',
    // Add other colors if needed
};

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
                        photoURL: user.photoURL || 'default-avatar-url',
                        role: 'user',
                        channels: [personalChannelId],
                        darkMode: false,
                        notificationsEnabled: false,
                        colors: userColors // Save default colors
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
                photoURL: user.photoURL || 'default-avatar-url',
                role: 'user',
                channels: [`personal-${user.uid}`],
                darkMode: false,
                notificationsEnabled: false,
                colors: userColors // Default colors
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

            // Load user's color preferences
            if (userData.colors) {
                userColors = userData.colors;
            }
            applyCustomColors();
            applyDarkMode();

            document.getElementById('add-channel').removeAttribute('disabled');
            document.getElementById('join-channel').removeAttribute('disabled');

            setupUIEventListeners();
            currentChannel = `personal-${user.uid}`;
            loadChannels();

            // Initialize PeerJS after currentUser is available
            initializePeer(); // Make sure this function is defined in voicecall.js

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

    // Toggle Dark Mode
    document.getElementById('toggle-dark-mode').addEventListener('click', () => {
        darkMode = !darkMode;
        applyDarkMode();
        db.collection('users').doc(currentUser.uid).update({
            darkMode: darkMode
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
            Notification.requestPermission();
        }
        db.collection('users').doc(currentUser.uid).update({
            notificationsEnabled: notificationsEnabled
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
                        alert('Invalid join code');
                    }
                }).catch(error => {
                    console.error("Error joining channel:", error);
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
            }
        } catch (error) {
            console.error("Error copying join code:", error);
            alert('Failed to copy join code');
        }
    });

    // Initialize color pickers with current values
    document.getElementById('primary-color-picker').value = userColors.primaryColor;
    document.getElementById('background-color-picker').value = userColors.backgroundColor;

    // Event listener for Save Colors button
    document.getElementById('save-color-settings').addEventListener('click', () => {
        // Get selected colors
        const primaryColor = document.getElementById('primary-color-picker').value;
        const backgroundColor = document.getElementById('background-color-picker').value;

        // Update userColors object
        userColors.primaryColor = primaryColor;
        userColors.backgroundColor = backgroundColor;

        // Apply the custom colors
        applyCustomColors();
        applyDarkMode(); // Reapply dark mode with new colors

        // Save the colors to Firestore
        db.collection('users').doc(currentUser.uid).update({
            colors: userColors
        }).then(() => {
            alert('Color settings saved successfully!');
        }).catch(error => {
            console.error("Error saving color settings:", error);
            alert('Failed to save color settings');
        });
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
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                messageInput.value = '';
            }).catch(error => {
                console.error("Error sending message:", error);
            });
    }
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

                // Sender name
                const senderNameElement = document.createElement('span');
                senderNameElement.textContent = message.sender;

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
        });
}

function applyCustomColors() {
    document.documentElement.style.setProperty('--primary-color', userColors.primaryColor);
    document.documentElement.style.setProperty('--background-color', userColors.backgroundColor);
}

function applyDarkMode() {
    if(darkMode) {
        // Apply darker shades based on user's custom colors
        const darkerPrimary = shadeColor(userColors.primaryColor, -20);
        const darkerBackground = shadeColor(userColors.backgroundColor, -20);

        document.documentElement.style.setProperty('--primary-color', darkerPrimary);
        document.documentElement.style.setProperty('--background-color', darkerBackground);
    } else {
        // Use user's custom colors
        applyCustomColors();
    }
}

// Utility function to adjust color brightness
function shadeColor(color, percent) {
    // Convert hex color to RGB
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);

    // Adjust color
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  

    // Convert back to hex
    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#" + RR + GG + BB;
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Error logging out:", error);
    });
}

// Function to switch channels
function switchChannel(channelId) {
    currentChannel = channelId; // Update `currentChannel` when switching channels
    loadMessages(channelId);     // Load messages for the new channel
    loadChannelPeerId(channelId); // Load and set `currentChannelPeerId` (from voicecall.js)
}
