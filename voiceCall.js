// voicecall.js

import AgoraRTC from "agora-rtc-sdk-ng";

let client; // Agora client instance
let localAudioTrack;
let currentChannel; // Make sure this variable is set to your current channel ID
let callUnsubscribes = []; // Stores unsubscribe functions for Firestore listeners

const APP_ID = "74e58a770e774705a2a1ce38bf08f2ac"; // Replace with your Agora App ID
const TOKEN = null; // Use null for testing; generate a token for production

// Function to initialize Agora client
function initializeAgoraClient() {
    if (!client) {
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        // Listen for remote users publishing their tracks
        client.on("user-published", handleUserPublished);
        client.on("user-unpublished", handleUserUnpublished);
    }
}

// Function to handle when a remote user publishes their track
async function handleUserPublished(user, mediaType) {
    console.log("User published:", user.uid);

    // Subscribe to the remote user
    await client.subscribe(user, mediaType);

    if (mediaType === "audio") {
        const remoteAudioTrack = user.audioTrack;
        remoteAudioTrack.play();
    }
}

// Function to handle when a remote user unpublishes their track
function handleUserUnpublished(user) {
    console.log("User unpublished:", user.uid);
    // Handle cleanup if necessary
}

// Function to start or join a call
async function startOrJoinCall() {
    initializeAgoraClient();

    try {
        // Join the Agora channel
        const uid = await client.join(APP_ID, currentChannel, TOKEN, currentUser.uid);
        console.log("Joined Agora channel with UID:", uid);

        // Create and publish local audio track
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([localAudioTrack]);
        console.log("Published local audio track.");

        // Update Firestore to indicate that the user has joined the call
        joinActiveCall();
    } catch (error) {
        console.error("Error joining Agora channel:", error);
        alert('An error occurred while trying to join the voice call.');
    }
}

// Function to join the active call in the channel
function joinActiveCall() {
    const channelRef = db.collection('channels').doc(currentChannel);

    // Add self to activeCallMembers in Firestore
    channelRef.update({
        activeCallMembers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        callActive: true
    }).then(() => {
        console.log('Joined active call in channel:', currentChannel);
        // Listen for changes in activeCallMembers
        listenToActiveCallMembers();
    }).catch(error => console.error("Error joining call:", error));
}

// Function to listen to changes in activeCallMembers
function listenToActiveCallMembers() {
    console.log('Listening to active call members in channel:', currentChannel);
    // Unsubscribe from previous listener if exists
    callUnsubscribes.forEach(unsub => unsub());
    callUnsubscribes = [];

    const channelRef = db.collection('channels').doc(currentChannel);

    const unsubscribe = channelRef.onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const activeMembers = data.activeCallMembers || [];
            console.log('Active call members:', activeMembers);

            // Update the call button text based on callActive and active members
            updateCallButton(data.callActive, activeMembers);
        }
    });

    callUnsubscribes.push(unsubscribe);
}

// Add event listener for the voice call button
document.getElementById('make-voice-call').addEventListener('click', () => {
    const buttonText = document.getElementById('make-voice-call').textContent;
    if (buttonText === 'Make Voice Call' || buttonText === 'Join Call') {
        startOrJoinCall();
    }
});

// Add event listener for ending the call
document.getElementById('end-call').addEventListener('click', () => {
    endGroupCall();
});

// Function to end the group call
async function endGroupCall() {
    console.log('Ending group call...');

    // Remove self from activeCallMembers in Firestore
    const channelRef = db.collection('channels').doc(currentChannel);
    try {
        await channelRef.update({
            activeCallMembers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        });

        // Unpublish and close local audio track
        if (localAudioTrack) {
            await client.unpublish([localAudioTrack]);
            localAudioTrack.close();
            localAudioTrack = null;
            console.log('Unpublished and closed local audio track.');
        }

        // Leave the Agora channel
        await client.leave();
        console.log('Left Agora channel.');

        // Hide end call button
        document.getElementById('end-call').style.display = 'none';

        // Unsubscribe from Firestore listeners
        callUnsubscribes.forEach(unsub => unsub());
        callUnsubscribes = [];

        // Check if we are the last person in the call
        const doc = await channelRef.get();
        if (doc.exists) {
            const data = doc.data();
            const activeMembers = data.activeCallMembers || [];
            if (activeMembers.length === 0) {
                // No one else in the call, set callActive to false and clear activeCallMembers
                await channelRef.update({
                    callActive: false,
                    activeCallMembers: firebase.firestore.FieldValue.delete()
                });
                console.log('No active members left. Call is now inactive.');
            }
        }
    } catch (error) {
        console.error("Error ending call:", error);
    }
}

// Clean up when switching channels
function leaveCurrentCall() {
    console.log('Leaving current call in channel:', currentChannel);
    if (localAudioTrack) {
        endGroupCall();
    } else {
        // Even if not in call, unsubscribe from listeners and update button
        callUnsubscribes.forEach(unsub => unsub());
        callUnsubscribes = [];
        updateCallButton(false, []);
    }
}

// Listener for changes in callActive to update the button text
function listenToCallActive() {
    console.log('Listening to callActive changes in channel:', currentChannel);
    const channelRef = db.collection('channels').doc(currentChannel);

    const unsubscribe = channelRef.onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const activeMembers = data.activeCallMembers || [];
            updateCallButton(data.callActive, activeMembers);
        }
    });

    callUnsubscribes.push(unsubscribe);
}

// Function to update the call button based on call status
function updateCallButton(callActive, activeMembers) {
    const callButton = document.getElementById('make-voice-call');

    if (callActive) {
        if (activeMembers.includes(currentUser.uid)) {
            // User is in call
            callButton.style.display = 'none';
            document.getElementById('end-call').style.display = 'block';
        } else {
            // User is not in call
            callButton.textContent = 'Join Call';
            callButton.style.display = 'inline-block';
            document.getElementById('end-call').style.display = 'none';
        }
    } else {
        // No active call
        callButton.textContent = 'Make Voice Call';
        callButton.style.display = 'inline-block';
        document.getElementById('end-call').style.display = 'none';
    }
}

// Call this function when switching channels to set up the listener
function setupCallListeners() {
    leaveCurrentCall(); // Ensure we leave any previous calls
    listenToCallActive(); // Start listening to callActive changes
}

// Expose functions to global scope so they can be called from chat.js
window.leaveCurrentCall = leaveCurrentCall;
window.setupCallListeners = setupCallListeners;
