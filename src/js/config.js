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
            return this.authReady || Promise.resolve();
        }

        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }

        const runtime=window.LYRIA_RUNTIME;
        if(!runtime?.firebase)throw new Error('Public Firebase runtime configuration is missing.');
        if(runtime?.origin && location.origin!==runtime.origin)return Promise.reject(new Error('This build is configured for a different site.'));
        const config={...runtime.firebase};
        try {
            // Initialize Firebase
            this.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            // Regular long-poll requests tolerate mobile network switches and buffering proxies.
            // Configure transport and any emulator host together, before persistence or reads.
            // Firestore warns when useEmulator() replaces a host configured by settings().
            const firestoreSettings={experimentalForceLongPolling: true, useFetchStreams: false};
            if(runtime?.emulators){firestoreSettings.host=runtime.emulators.host+':'+runtime.emulators.firestorePort;firestoreSettings.ssl=false;}
            this.db.settings(firestoreSettings);
            
            if(runtime?.emulators)this.auth.useEmulator?.('http://'+runtime.emulators.host+':'+runtime.emulators.authPort,{disableWarnings:true});
            // Emulator sessions are disposable and should not retain IndexedDB data. The compat
            // persistence API is retained for production until the modular SDK migration.
            if(!runtime?.emulators)this.db.enablePersistence({synchronizeTabs: true}).catch((err) => {
                console.warn('Firestore persistence failed:', err.code);
            });

            this.authReady = typeof this.auth.setPersistence === 'function'
                ? this.auth.setPersistence('local').catch(() => this.auth.setPersistence('session')).catch(() => {
                    this.loginStorageUnavailable = true;
                    console.warn('Login storage unavailable; this session may not survive closing the browser.');
                }) : Promise.resolve();
            this.initialized = true;
            console.log('Firebase initialized successfully');
            return this.authReady;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw error;
        }
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
