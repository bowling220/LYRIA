import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - credentials loaded from environment variables
const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyAVmCYgkVfYeX7yNFPoOWpMy1Jra3mMZIs",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "lyria-c2cae.firebaseapp.com",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "lyria-c2cae",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "lyria-c2cae.firebasestorage.app",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "1077016298588",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:1077016298588:web:bb0dfcd532632ca5bd5299",
    measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-4QXTS7DWPZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
