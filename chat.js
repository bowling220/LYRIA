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
  let isAdmin = false;
  
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
      // Create a personal channel for new users
      const personalChannelId = `personal-${user.uid}`;
      return Promise.all([
        userDocRef.set({
          displayName: user.displayName || 'User',
          role: 'user',
          channels: [personalChannelId],
          darkMode: false,
          notificationsEnabled: false,
          isAdmin: false
        }),
        db.collection('channels').doc(personalChannelId).set({
          name: 'My Personal Channel',
          id: personalChannelId,
          createdBy: user.uid,
          joinCode: generateJoinCode(),
          members: [user.uid]
        })
      ]);
    }
    return doc;
  }).then(doc => {
    const userData = doc.exists ? doc.data() : {
      displayName: user.displayName || 'User',
      role: 'user',
      channels: [`personal-${user.uid}`],
      darkMode: false,
      notificationsEnabled: false,
      isAdmin: false
    };
    
    isAdmin = userData.isAdmin || false;
    document.getElementById('user-name').textContent = userData.displayName;
    
    // Initialize settings from user data
    darkMode = userData.darkMode;
    notificationsEnabled = userData.notificationsEnabled;
    document.getElementById('notifications-toggle').checked = notificationsEnabled;
    if(darkMode) {
      document.documentElement.style.setProperty('--primary-color', '#1a1a1a');
      document.documentElement.style.setProperty('--background-color', '#121212');
    }
    
    document.getElementById('add-channel').removeAttribute('disabled');
    document.getElementById('join-channel').removeAttribute('disabled');
  
    function logout() {
      auth.signOut().then(() => {
          window.location.href = 'index.html';
      }).catch(error => {
          console.error("Error logging out:", error);
      });
    }
  
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
  
    // Update Display Name
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
    
    // Set initial channel to user's personal channel
    currentChannel = `personal-${user.uid}`;
  }).catch(error => {
    console.error("Error handling user data:", error);
  });
  
  loadChannels();
  } else {
  window.location.href = 'login.html';
  }
  });
  
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
      button.onclick = () => {
        currentChannel = channel.id;
        loadMessages(channel.id);
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
    
    // Load messages for personal channel by default
    loadMessages(`personal-${currentUser.uid}`);
  })
  .catch(error => {
    console.error("Error loading channels:", error);
  });
  }
  
  function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
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
          currentChannel = channel.id;
          loadMessages(channel.id);
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
  
  function loadMessages(channelId) {
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
  
  db.collection('channels').doc(channelId).collection('messages')
  .orderBy('timestamp')
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const message = change.doc.data();
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        let adminBadge = '';
        if(message.isAdmin) {
          adminBadge = '<span class="admin-badge">👑 Admin</span>';
        }
        
        messageElement.innerHTML = `
          <div class="message-content">
            <div class="message-header">
              <span class="message-username">${message.sender}</span>
              ${adminBadge}
            </div>
            <div class="message-text">${message.message}</div>
          </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        
        // Show notification if enabled and message is not from current user
        if(notificationsEnabled && message.sender !== currentUser.displayName && Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `${message.sender}: ${message.message}`,
            icon: '/path/to/icon.png'
          });
        }
      }
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, error => {
    console.error("Error loading messages:", error);
  });
  }
  
  document.getElementById('send-button').addEventListener('click', () => {
  const messageInput = document.getElementById('message-input');
  const message = messageInput.value.trim();
  
  if (message && currentChannel) {
  db.collection('channels').doc(currentChannel)
    .collection('messages').add({
      message: message,
      sender: currentUser.displayName || 'User',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      isAdmin: isAdmin
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
  