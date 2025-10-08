// Firebase configuration - loaded from environment variables for security
// In production, these should be replaced with actual environment variable values
const firebaseConfig = {
    apiKey: window?.env?.VITE_FIREBASE_API_KEY || "AIzaSyAVmCYgkVfYeX7yNFPoOWpMy1Jra3mMZIs",
    authDomain: window?.env?.VITE_FIREBASE_AUTH_DOMAIN || "lyria-c2cae.firebaseapp.com",
    projectId: window?.env?.VITE_FIREBASE_PROJECT_ID || "lyria-c2cae",
    storageBucket: window?.env?.VITE_FIREBASE_STORAGE_BUCKET || "lyria-c2cae.firebasestorage.app",
    messagingSenderId: window?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "1077016298588",
    appId: window?.env?.VITE_FIREBASE_APP_ID || "1:1077016298588:web:bb0dfcd532632ca5bd5299",
    measurementId: window?.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-4QXTS7DWPZ"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Settings Modal Functionality
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeModal = document.getElementById('close-modal');
const logoutBtn = document.getElementById('logout-btn');
const updateDisplayNameBtn = document.getElementById('update-display-name');
const displayNameInput = document.getElementById('display-name-input');

settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Update Display Name
updateDisplayNameBtn.addEventListener('click', () => {
    const newDisplayName = displayNameInput.value.trim();
    if (newDisplayName) {
        const user = auth.currentUser;
        db.collection('users').doc(user.uid).update({
            displayName: newDisplayName
        }).then(() => {
            document.getElementById('user-name').textContent = newDisplayName;
            displayNameInput.value = '';
            alert('Display name updated successfully!');
        }).catch(error => {
            console.error("Error updating display name:", error);
            alert('Error updating display name');
        });
    }
});

// Logout functionality
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
});

// Auth state observer
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        const userId = user.uid;

        // Fetch user data from Firestore
        db.collection('users').doc(userId).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('user-name').textContent = userData.displayName;
                document.getElementById('user-avatar').src = userData.photoURL || 'assets/icon.png';
            } else {
                console.log("No such document!");
            }
        }).catch(error => {
            console.error("Error getting document:", error);
        });

        // Load friend requests and history
        loadFriendRequests(userId);
    } else {
        // No user is signed in, redirect to login
        window.location.href = 'login.html';
    }
});

async function handleFriendRequest(requestId, action, senderId) {
    const currentUser = firebase.auth().currentUser;

    if (!currentUser) {
        alert('You must be logged in to handle friend requests.');
        return;
    }

    try {
        if (action === 'accept' || action === 'decline') {
            // Fetch the friend request document
            const requestDoc = await db.collection('friendRequests').doc(requestId).get();
            if (!requestDoc.exists) {
                throw new Error("Friend request not found");
            }

            const requestData = requestDoc.data();

            // Check if the current user is the intended recipient
            if (requestData.to !== currentUser.uid) {
                throw new Error("You are not authorized to handle this friend request.");
            }

            if (action === 'accept') {
                // Add users as friends in both user documents
                await db.collection('users').doc(currentUser.uid).update({
                    friends: firebase.firestore.FieldValue.arrayUnion(senderId)
                });
                await db.collection('users').doc(senderId).update({
                    friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                });
            }

            // Update request status and add timestamp
            await db.collection('friendRequests').doc(requestId).update({
                status: action,
                actionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Refresh the friend requests display
            loadFriendRequests(currentUser.uid);
        }
    } catch (error) {
        console.error("Error handling friend request:", error);
        alert('Error processing friend request: ' + error.message);
    }
}

async function loadFriendRequests(userId) {
    const inboxMessagesContainer = document.getElementById('inbox-messages');
    inboxMessagesContainer.innerHTML = ''; // Clear previous messages

    // Create sections for pending and history
    const pendingSection = document.createElement('div');
    pendingSection.innerHTML = '<h3>Pending Requests</h3>';
    const historySection = document.createElement('div');
    historySection.innerHTML = '<h3>Request History</h3>';

    // Fetch all friend requests from Firestore
    const snapshot = await db.collection('friendRequests')
        .where('to', '==', userId)
        .orderBy('actionTimestamp', 'desc')
        .get();

    if (snapshot.empty) {
        inboxMessagesContainer.innerHTML = '<div class="no-requests">No Friend Requests</div>';
        return;
    }

    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    for (const doc of snapshot.docs) {
        const requestData = doc.data();
        const senderDoc = await db.collection('users').doc(requestData.from).get();
        const senderData = senderDoc.data();

        // Check if already friends for pending requests
        if (requestData.status === 'pending' && userData.friends && userData.friends.includes(requestData.from)) {
            continue;
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'inbox-message';

        const messageContent = document.createElement('div');
        messageContent.textContent = `${senderData.displayName} sent you a friend request!`;

        if (requestData.status === 'pending') {
            const actionButtons = document.createElement('div');
            actionButtons.className = 'friend-request-actions';

            const acceptButton = document.createElement('button');
            acceptButton.className = 'accept-btn';
            acceptButton.textContent = 'Accept';
            acceptButton.onclick = () => handleFriendRequest(doc.id, 'accept', requestData.from);

            const declineButton = document.createElement('button');
            declineButton.className = 'decline-btn';
            declineButton.textContent = 'Decline';
            declineButton.onclick = () => handleFriendRequest(doc.id, 'decline', requestData.from);

            actionButtons.appendChild(acceptButton);
            actionButtons.appendChild(declineButton);
            messageElement.appendChild(messageContent);
            messageElement.appendChild(actionButtons);
            pendingSection.appendChild(messageElement);
        } else {
            // Add status and timestamp for history
            const status = requestData.status === 'accept' ? 'Accepted' : 'Declined';
            const timestamp = requestData.actionTimestamp ? requestData.actionTimestamp.toDate().toLocaleString() : 'Unknown time';
            messageContent.textContent = `${senderData.displayName}'s friend request was ${status.toLowerCase()} on ${timestamp}`;
            messageElement.appendChild(messageContent);
            historySection.appendChild(messageElement);
        }
    }

    inboxMessagesContainer.appendChild(pendingSection);
    inboxMessagesContainer.appendChild(historySection);
}