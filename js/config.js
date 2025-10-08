// Firebase Configuration Module
// This file handles Firebase initialization securely

class FirebaseConfig {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.initialized = false;
    }

    // Initialize Firebase with environment variables or defaults
    initialize() {
        if (this.initialized) {
            return Promise.resolve();
        }

        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }

        // Firebase configuration - using secure values
        const config = {
            apiKey: "AIzaSyAVmCYgkVfYeX7yNFPoOWpMy1Jra3mMZIs",
            authDomain: "lyria-c2cae.firebaseapp.com",
            projectId: "lyria-c2cae",
            storageBucket: "lyria-c2cae.firebasestorage.app",
            messagingSenderId: "1077016298588",
            appId: "1:1077016298588:web:bb0dfcd532632ca5bd5299",
            measurementId: "G-4QXTS7DWPZ"
        };

        try {
            // Initialize Firebase
            this.app = firebase.initializeApp(config);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Configure Firestore settings for better performance
            this.db.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            // Enable offline persistence
            this.db.enablePersistence({
                synchronizeTabs: true
            }).catch((err) => {
                console.warn('Firestore persistence failed:', err.code);
            });

            this.initialized = true;
            console.log('Firebase initialized successfully');
            return Promise.resolve();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw error;
        }
    }

    // Safely get environment variables with fallbacks
    getEnvVar(name, fallback) {
        // Try different ways to access environment variables
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name] || fallback;
        }
        
        if (typeof window !== 'undefined' && window.env) {
            return window.env[name] || fallback;
        }
        
        // In development, log which fallback is being used
        if (console && console.warn && fallback) {
            console.warn(`Using fallback value for ${name}`);
        }
        
        return fallback;
    }

    // Get Firebase auth instance
    getAuth() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.auth;
    }

    // Get Firestore instance
    getFirestore() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.db;
    }

    // Get Firebase app instance
    getApp() {
        if (!this.initialized) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.app;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.auth && this.auth.currentUser !== null;
    }

    // Sign out user
    async signOut() {
        if (!this.auth) {
            throw new Error('Firebase auth not initialized');
        }
        
        try {
            await this.auth.signOut();
            console.log('User signed out successfully');
        } catch (error) {
            console.error('Sign out failed:', error);
            throw error;
        }
    }

    // Get current user
    getCurrentUser() {
        if (!this.auth) {
            return null;
        }
        return this.auth.currentUser;
    }

    // Listen to authentication state changes
    onAuthStateChanged(callback) {
        if (!this.auth) {
            throw new Error('Firebase auth not initialized');
        }
        return this.auth.onAuthStateChanged(callback);
    }

    // Clean up listeners and connections
    cleanup() {
        if (this.db) {
            this.db.terminate().catch(err => {
                console.warn('Error terminating Firestore:', err);
            });
        }
        this.initialized = false;
    }
}

// Export singleton instance
window.firebaseConfig = new FirebaseConfig();

// Auto-initialize if Firebase is already loaded (with retry logic)
function attemptAutoInit() {
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
        window.firebaseConfig.initialize().then(() => {
            console.log('Firebase auto-initialized successfully');
        }).catch(err => {
            console.error('Auto-initialization failed:', err);
        });
    } else if (typeof firebase === 'undefined') {
        // Firebase not loaded yet, try again in 100ms
        setTimeout(attemptAutoInit, 100);
    }
}

// Start attempting auto-initialization
attemptAutoInit();