// voicecall.js

let peer;
let currentCalls = {}; // Stores active calls with other peers
let localStream;
let callUnsubscribes = []; // Stores unsubscribe functions for Firestore listeners

// Function to initialize PeerJS
function initializePeer() {
    if (!peer) {
        peer = new Peer(currentUser.uid); // Use user's UID as peer ID
    }

    peer.on('open', (id) => {
        console.log('Your peer ID is: ' + id);
        // Save your own peerId in your user document (optional since we're using UID as peer ID)
    });

    // Listen for incoming calls
    peer.on('call', (call) => {
        // Answer the call with the local audio stream
        if (localStream) {
            call.answer(localStream);
            handleCallEvents(call);
        } else {
            // If localStream is not ready, get user media first
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    localStream = stream;
                    call.answer(localStream);
                    handleCallEvents(call);
                })
                .catch(error => console.error('Error accessing media devices.', error));
        }
    });
}

// Function to handle call events
function handleCallEvents(call) {
    currentCalls[call.peer] = call; // Add call to current calls
    document.getElementById('end-call').style.display = 'block'; // Show end call button

    call.on('stream', (remoteStream) => {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = remoteStream;
        remoteAudio.play();
    });

    call.on('close', () => {
        console.log("Call with peer " + call.peer + " ended.");
        delete currentCalls[call.peer]; // Remove call from current calls
        if (Object.keys(currentCalls).length === 0) {
            document.getElementById('end-call').style.display = 'none'; // Hide end call button if no calls are active
        }
    });
}

// Event listener for the voice call button
document.getElementById('make-voice-call').addEventListener('click', () => {
    startGroupCall();
});

// Function to start or join a group call
function startGroupCall() {
    // Get user media if not already obtained
    if (!localStream) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                localStream = stream;
                joinActiveCall();
            })
            .catch(error => console.error('Error accessing media devices.', error));
    } else {
        joinActiveCall();
    }
}

// Function to join the active call in the channel
function joinActiveCall() {
    // Add self to activeCallMembers in Firestore
    const channelRef = db.collection('channels').doc(currentChannel);

    // Update the activeCallMembers array atomically
    channelRef.update({
        activeCallMembers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    }).then(() => {
        // Listen for changes in activeCallMembers
        listenToActiveCallMembers();
    }).catch(error => console.error("Error joining call:", error));
}

// Function to listen to changes in activeCallMembers
function listenToActiveCallMembers() {
    // Unsubscribe from previous listener if exists
    callUnsubscribes.forEach(unsub => unsub());
    callUnsubscribes = [];

    const channelRef = db.collection('channels').doc(currentChannel);

    const unsubscribe = channelRef.onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const activeMembers = data.activeCallMembers || [];
            // Remove self from the list to get other participants
            const otherMembers = activeMembers.filter(uid => uid !== currentUser.uid);

            // Connect to new participants
            otherMembers.forEach(memberUid => {
                if (!currentCalls[memberUid]) {
                    // Call the other peer
                    callPeer(memberUid);
                }
            });

            // Disconnect from participants who left
            Object.keys(currentCalls).forEach(peerId => {
                if (!activeMembers.includes(peerId)) {
                    // Close the call
                    currentCalls[peerId].close();
                    delete currentCalls[peerId];
                }
            });

            // Show or hide the end call button
            if (Object.keys(currentCalls).length > 0) {
                document.getElementById('end-call').style.display = 'block';
            } else {
                document.getElementById('end-call').style.display = 'none';
            }
        }
    });

    callUnsubscribes.push(unsubscribe);
}

// Function to call another peer
function callPeer(peerId) {
    const call = peer.call(peerId, localStream);
    handleCallEvents(call);
}

// Add event listener for ending the call
document.getElementById('end-call').addEventListener('click', () => {
    endGroupCall();
});

// Function to end the group call
function endGroupCall() {
    // Remove self from activeCallMembers in Firestore
    const channelRef = db.collection('channels').doc(currentChannel);
    channelRef.update({
        activeCallMembers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    }).then(() => {
        // Close all current calls
        Object.values(currentCalls).forEach(call => {
            call.close();
        });
        currentCalls = {};

        // Stop local audio stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Hide end call button
        document.getElementById('end-call').style.display = 'none';

        // Unsubscribe from Firestore listeners
        callUnsubscribes.forEach(unsub => unsub());
        callUnsubscribes = [];
    }).catch(error => console.error("Error ending call:", error));
}

// Clean up when switching channels
function leaveCurrentCall() {
    if (localStream || Object.keys(currentCalls).length > 0) {
        endGroupCall();
    }
}
