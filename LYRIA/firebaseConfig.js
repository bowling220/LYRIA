import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Every EXPO_PUBLIC_* value is readable in the app bundle. Never use server secrets.
const projectId=process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-lyria';
const useEmulators=process.env.EXPO_PUBLIC_USE_EMULATORS !== 'false';
if(useEmulators && !projectId.startsWith('demo-'))throw new Error('Emulator development must use a demo-* project.');
const app=initializeApp({
 apiKey:process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
 authDomain:process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-lyria.firebaseapp.com',
 projectId,
 storageBucket:process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-lyria.appspot.com',
 messagingSenderId:process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
 appId:process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:demo'
});
const auth=getAuth(app),db=getFirestore(app);
if(useEmulators){
 const host=process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
 connectAuthEmulator(auth,'http://'+host+':9099',{disableWarnings:true});connectFirestoreEmulator(db,host,8085);
}
export {auth,db};
