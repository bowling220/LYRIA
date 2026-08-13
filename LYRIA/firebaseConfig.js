import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - credentials loaded from environment variables
const firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyDWpApnJ-mfHQJZhkbNDdsJ7l8-8rVHHTc",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "lyria-49a54.firebaseapp.com",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "lyria-49a54",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "lyria-49a54.firebasestorage.app",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "704449928785",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:704449928785:web:5b3c58c8f82d31d3f1a270",
    measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-KV5FRFN63T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
