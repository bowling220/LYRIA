// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser;

// Load user data on page load
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadUserProfile(user.uid);
    } else {
        window.location.href = 'index.html'; // Redirect if not logged in
    }
});

// Load User Profile Data
function loadUserProfile(userId) {
    db.collection('users').doc(userId).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('username').value = data.displayName || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('user-avatar').src = data.photoURL || 'default-avatar.png';
        }
    }).catch(error => console.error("Error loading profile:", error));
}

// Save Updated Profile Data
document.getElementById('save-profile').addEventListener('click', () => {
    const updatedName = document.getElementById('username').value;
    const updatedEmail = document.getElementById('email').value;
    
    db.collection('users').doc(currentUser.uid).update({
        displayName: updatedName,
        email: updatedEmail
    }).then(() => {
        alert("Profile updated successfully!");
        updateHomePage(); // Reflect changes on the Home page
    }).catch(error => console.error("Error saving profile:", error));
});

// Update Home Page Data
function updateHomePage() {
    localStorage.setItem('displayName', document.getElementById('username').value);
    localStorage.setItem('email', document.getElementById('email').value);
}

// Close Settings Button
document.querySelector('.close-settings').addEventListener('click', () => {
    window.location.href = 'index.html';
});
