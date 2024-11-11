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
const rtdb = firebase.database();

let currentUser;
let currentChannel;
let darkMode = false;
let notificationsEnabled = false;

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
                        photoURL: user.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png',
                        role: 'user',
                        channels: [personalChannelId],
                        darkMode: false,
                        notificationsEnabled: false
                    }),
                    db.collection('channels').doc(personalChannelId).set({
                        name: 'My Personal Channel',
                        id: personalChannelId,
                        createdBy: user.uid,
                        admins: [user.uid],
                        joinCode: generateJoinCode(),
                        members: [user.uid]
                    })
                ]);
            }
            return doc;
        }).then(doc => {
            const userData = doc.exists ? doc.data() : {
                displayName: user.displayName || 'User',
                photoURL: user.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png',
                role: 'user',
                channels: [`personal-${user.uid}`],
                darkMode: false,
                notificationsEnabled: false
            };

            document.getElementById('user-name').textContent = userData.displayName;
            document.getElementById('user-avatar').src = userData.photoURL;

            darkMode = userData.darkMode;
            notificationsEnabled = userData.notificationsEnabled;
            document.getElementById('notifications-toggle').checked = notificationsEnabled;
            
            if(darkMode) {
                document.documentElement.style.setProperty('--primary-color', '#1a1a1a');
                document.documentElement.style.setProperty('--background-color', '#121212');
            }

            document.getElementById('add-channel').removeAttribute('disabled');
            document.getElementById('join-channel').removeAttribute('disabled');

            // Set initial channel to user's personal channel
            currentChannel = `personal-${user.uid}`;
            loadChannels();
            updateOnlineStatus(true);
            listenForOnlineUsers();
        }).catch(error => {
            console.error("Error handling user data:", error);
        });
    } else {
        window.location.href = 'login.html';
    }
});

function updateOnlineStatus(online) {
    if (currentUser) {
        const userStatusRef = rtdb.ref(`status/${currentUser.uid}`);
        userStatusRef.set({
            online: online,
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png'
        });
        userStatusRef.onDisconnect().set({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png'
        });
    }
}

function listenForOnlineUsers() {
    rtdb.ref("status").on("value", (snapshot) => {
        const usersList = document.getElementById("users-list");
        usersList.innerHTML = "";
        snapshot.forEach(userSnapshot => {
            const userStatus = userSnapshot.val();
            if (userStatus.online) {
                const li = document.createElement("li");
                li.className = "user-item";
                const statusDot = document.createElement("span");
                statusDot.className = "user-status online";

                const avatar = document.createElement("img");
                avatar.src = userStatus.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png';
                avatar.alt = "User avatar";
                avatar.className = "user-avatar";

                const nameSpan = document.createElement("span");
                nameSpan.className = "user-name";
                nameSpan.textContent = userStatus.displayName || 'User';

                li.appendChild(statusDot);
                li.appendChild(avatar);
                li.appendChild(nameSpan);
                usersList.appendChild(li);
            }
        });
    });
}

function loadChannels() {
    const channelsList = document.getElementById('channels-list');
    channelsList.innerHTML = '';

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
                
                // Add admin crown if user is admin
                if (channel.admins && channel.admins.includes(currentUser.uid)) {
                    const adminCrown = document.createElement('span');
                    adminCrown.textContent = '👑';
                    adminCrown.className = 'admin-indicator';
                    button.appendChild(adminCrown);
                }

                button.onclick = () => {
                    currentChannel = channel.id;
                    loadMessages(channel.id);
                    document.querySelectorAll('.channel-btn').forEach(btn => 
                        btn.classList.remove('active-channel'));
                    button.classList.add('active-channel');
                    document.getElementById('message-input').placeholder = 
                        `Message #${channel.name}`;
                    
                    if (window.innerWidth <= 768) {
                        document.querySelector('.sidebar').classList.remove('active');
                    }
                };
                channelElement.appendChild(button);
                channelsList.appendChild(channelElement);
            });

            // Load messages for personal channel by default
            loadMessages(`personal-${currentUser.uid}`);
        })
        .catch(error => {
            console.error("Error loading channels:", error);
        });
}

function loadMessages(channelId) {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.innerHTML = '';
    const channelTitle = document.getElementById('channel-title');

    db.collection('channels').doc(channelId).get().then(doc => {
        if (doc.exists) {
            const channelData = doc.data();
            const admins = channelData.admins || [channelData.createdBy];
            channelTitle.textContent = `#${channelData.name}`;
            document.getElementById('message-input').placeholder = `Message #${channelData.name}`;

            db.collection('channels').doc(channelId).collection('messages')
                .orderBy('timestamp')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const message = change.doc.data();
                            const isAdmin = admins.includes(message.userId);
                            const messageElement = document.createElement('div');
                            messageElement.className = 'message';
                            messageElement.innerHTML = `
                                <img class="message-avatar" src="${message.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png'}" alt="User avatar">
                                <div class="message-content">
                                    <div class="message-header">
                                        <span class="message-username">${message.sender}</span>
                                        ${isAdmin ? '<span class="admin-badge">👑 Admin</span>' : ''}
                                        <span class="message-timestamp">${formatTimestamp(message.timestamp)}</span>
                                    </div>
                                    <div class="message-text">${formatMessage(message.message)}</div>
                                </div>
                            `;
                            messagesContainer.appendChild(messageElement);

                            if (notificationsEnabled && 
                                message.userId !== currentUser.uid && 
                                Notification.permission === 'granted') {
                                new Notification('New Message', {
                                    body: `${message.sender}: ${message.message}`,
                                    icon: message.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png'
                                });
                            }
                        }
                    });
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                });
        }
    }).catch(error => {
        console.error("Error loading messages:", error);
    });
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'long' }) + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString() + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessage(text) {
    if (!text) return '';
    
    // Basic XSS prevention
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Convert URLs to clickable links
    text = text.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

function generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Event Listeners
document.getElementById('send-button').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message && currentChannel) {
        db.collection('channels').doc(currentChannel)
            .collection('messages').add({
                message: message,
                sender: currentUser.displayName || 'User',
                userId: currentUser.uid,
                photoURL: currentUser.photoURL || 'https://s1.ezgif.com/tmp/ezgif-1-89965b355d.png',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                messageInput.value = '';
            }).catch(error => {
                console.error("Error sending message:", error);
            });
    }
});

document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('send-button').click();
    }
});

document.getElementById('add-channel').addEventListener('click', () => {
    const channelName = prompt('Enter channel name:');
    if (channelName) {
        const channelId = `${Date.now()}-${currentUser.uid}`;
        db.collection('channels').doc(channelId).set({
            name: channelName,
            id: channelId,
            createdBy: currentUser.uid,
            admins: [currentUser.uid],
            joinCode: generateJoinCode(),
            members: [currentUser.uid]
        }).then(() => {
            loadChannels();
        }).catch(error => {
            console.error("Error creating channel:", error);
        });
    }
});

document.getElementById('join-channel').addEventListener('click', () => {
    const joinCode = prompt('Enter channel join code:');
    if (joinCode) {
        db.collection('channels').where('joinCode', '==', joinCode).get()
            .then(snapshot => {
                if (!snapshot.empty) {
                    const channelDoc = snapshot.docs[0];
                    const channel = channelDoc.data();
                    return db.collection('channels').doc(channel.id).update({
                        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                    }).then(() => {
                        currentChannel = channel.id;
                        loadMessages(channel.id);
                        loadChannels();
                        alert(`Successfully joined #${channel.name}`);
                    });
                } else {
                    alert('Invalid join code');
                }
            }).catch(error => {
                console.error("Error joining channel:", error);
            });
    }
});

document.getElementById('copy-join-code').addEventListener('click', async () => {
    try {
        const doc = await db.collection('channels').doc(currentChannel).get();
        if (doc.exists) {
            const joinCode = doc.data().joinCode;
            await navigator.clipboard.writeText(joinCode);
            alert('Join code copied to clipboard: ' + joinCode);
        }
    } catch (error) {
        console.error("Error copying join code:", error);
        alert('Failed to copy join code');
    }
});

// Settings Modal Event Listeners
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'flex';
});

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'none';
});

document.getElementById('toggle-dark-mode').addEventListener('click', () => {
    darkMode = !darkMode;
    if(darkMode) {
        document.documentElement.style.setProperty('--primary-color', '#1a1a1a');
        document.documentElement.style.setProperty('--background-color', '#121212');
    } else {
        document.documentElement.style.setProperty('--primary-color', '#36393f');
        document.documentElement.style.setProperty('--background-color', '#2f3136');
    }
    db.collection('users').doc(currentUser.uid).update({
        darkMode: darkMode
    });
});

document.getElementById('update-display-name').addEventListener('click', () => {
    const newName = document.getElementById('display-name-input').value.trim();
    if(newName) {
        db.collection('users').doc(currentUser.uid).update({
            displayName: newName
        }).then(() => {
            document.getElementById('user-name').textContent = newName;
            document.getElementById('display-name-input').value = '';
            alert('Display name updated successfully!');
        }).catch(error => {
            console.error("Error updating display name:", error);
            alert('Failed to update display name');
        });
    }
});

document.getElementById('notifications-toggle').addEventListener('change', (e) => {
    notificationsEnabled = e.target.checked;
    if(notificationsEnabled) {
        Notification.requestPermission();
    }
    db.collection('users').doc(currentUser.uid).update({
        notificationsEnabled: notificationsEnabled
    });
});

document.getElementById('logout-btn').addEventListener('click', () => {
    updateOnlineStatus(false);
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch(error => {
        console.error("Error logging out:", error);
    });
});

// Handle window unload
window.addEventListener('beforeunload', () => {
    updateOnlineStatus(false);
});