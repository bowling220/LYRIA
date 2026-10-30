import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration - credentials loaded from environment variables
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDWpApnJ-mfHQJZhkbNDdsJ7l8-8rVHHTc",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "lyria-49a54.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "lyria-49a54",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "lyria-49a54.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "704449928785",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:704449928785:web:5b3c58c8f82d31d3f1a270",
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-KV5FRFN63T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true') {
    if (!firebaseConfig.projectId.startsWith('demo-')) throw new Error('Local emulators must use a demo-* project.');
    const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, 'http://' + emulatorHost + ':9099', { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8085);
}

export { auth, db };
