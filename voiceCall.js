let peer;
let currentCall;
let currentChannelPeerId; // Stores the peer ID for the other user in the current channel

// Function to initialize PeerJS
function initializePeer() {
    if (!peer) { // Create a new Peer instance only if it doesn’t already exist
        peer = new Peer();
    }

    // Ensure the peer ID is available before attempting to use it
    peer.on('open', (id) => {
        console.log('Your peer ID is: ' + id);
        // Save your own peerId in your user document
        db.collection('users').doc(currentUser.uid).set({
            peerId: id
        }, { merge: true }).catch(error => console.error("Error updating peer ID:", error));
    });
    
    // Listen for incoming calls
    peer.on('call', (call) => {
        // When a call is received, request user media
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                call.answer(stream); // Answer the call with your audio stream
                currentCall = call; // Keep track of the current call
                call.on('stream', (remoteStream) => {
                    const remoteAudio = document.createElement('audio');
                    remoteAudio.srcObject = remoteStream;
                    remoteAudio.play();
                });

                call.on('close', () => {
                    console.log("Call ended.");
                    // Stop your audio stream
                    stream.getTracks().forEach(track => track.stop());
                });
            })
            .catch(error => console.error('Error accessing media devices.', error));
    });
}

// Function to call another peer
function callPeer(peerId) {
    // Request user media
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            currentCall = peer.call(peerId, stream);
            currentCall.on('stream', (remoteStream) => {
                const remoteAudio = document.createElement('audio');
                remoteAudio.srcObject = remoteStream;
                remoteAudio.play();
            });
            currentCall.on('close', () => {
                console.log("Call ended.");
                // Stop your audio stream
                stream.getTracks().forEach(track => track.stop());
            });
        })
        .catch(error => console.error('Error accessing media devices.', error));
}

// Event listener for the voice call button in the selected chat channel
document.getElementById('make-voice-call').addEventListener('click', () => {
    if (currentChannelPeerId) {
        callPeer(currentChannelPeerId); // Call the peer ID of the other user
    } else {
        console.error('No peer ID available for this channel.');
        alert('The other user is not available for a voice call.');
    }
});

// Load the peer ID for the other user in a given channel
function loadChannelPeerId(channelId) {
    db.collection('channels').doc(channelId).get().then(doc => {
        if (doc.exists) {
            const channelData = doc.data();
            const members = channelData.members || [];
            // Remove the current user's UID to get the other user's UID
            const otherMembers = members.filter(uid => uid !== currentUser.uid);
            if (otherMembers.length > 0) {
                const otherUserUid = otherMembers[0]; // Assuming one-to-one channels
                // Get the peerId of the other user
                db.collection('users').doc(otherUserUid).get().then(userDoc => {
                    if (userDoc.exists && userDoc.data().peerId) {
                        currentChannelPeerId = userDoc.data().peerId;
                    } else {
                        console.warn("No peer ID found for the other user.");
                        currentChannelPeerId = null;
                    }
                }).catch(error => console.error("Error loading other user's peer ID:", error));
            } else {
                console.warn("No other users in this channel.");
                currentChannelPeerId = null;
            }
        } else {
            console.warn("Channel does not exist.");
            currentChannelPeerId = null;
        }
    }).catch(error => console.error("Error loading channel data:", error));
}

// Function to switch channels
function switchChannel(channelId) {
    currentChannel = channelId; // Update `currentChannel` when switching channels
    loadMessages(channelId);
    loadChannelPeerId(channelId); // Load and set `currentChannelPeerId`
}

// Initialize PeerJS when the application starts
initializePeer();
