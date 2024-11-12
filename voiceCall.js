let peer;
let localStream;
let currentCall;
let currentChannelPeerId; // Stores the peer ID for the current channel

// Function to initiate a voice call
function initiateVoiceCall() {
    if (!peer) { // Create a new Peer instance only if it doesn’t already exist
        peer = new Peer();
    }

    // Ensure the peer ID is available before attempting to use it
    peer.on('open', (id) => {
        console.log('Your peer ID is: ' + id);
        if (currentChannel) {
            db.collection('channels').doc(currentChannel).set({
                peerId: id
            }, { merge: true }).catch(error => console.error("Error updating peer ID:", error));
        }
    });
    

    // Get user media (audio)
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            localStream = stream;

            // Listen for incoming calls
            peer.on('call', (call) => {
                call.answer(localStream);
                call.on('stream', (remoteStream) => {
                    const remoteAudio = document.createElement('audio');
                    remoteAudio.srcObject = remoteStream;
                    remoteAudio.play();
                });
            });
        })
        .catch(error => console.error('Error accessing media devices.', error));
}

// Function to call another peer in the selected channel
function callPeerInChannel() {
    if (currentCall) {
        currentCall.close(); // Close any existing call
    }

    if (localStream && currentChannelPeerId) {
        currentCall = peer.call(currentChannelPeerId, localStream);
        currentCall.on('stream', (remoteStream) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play();
        });
        currentCall.on('close', () => {
            console.log("Call ended.");
        });
    } else {
        console.error('Local stream or channel peer ID is not available.');
    }
}

// Event listener for the voice call button in the selected chat channel
document.getElementById('make-voice-call').addEventListener('click', () => {
    callPeerInChannel(); // Automatically calls the peer ID of the current channel
});

// Load the peer ID for a given channel and set `currentChannelPeerId`
function loadChannelPeerId(channelId) {
    db.collection('channels').doc(channelId).get().then(doc => {
        if (doc.exists && doc.data().peerId) {
            currentChannelPeerId = doc.data().peerId;
        } else {
            console.warn("No peer ID found for this channel.");
        }
    }).catch(error => console.error("Error loading peer ID:", error));
}

// Example: Assuming each channel button has a data attribute `data-channel-id`
document.querySelectorAll('.channel-btn').forEach(button => {
    button.onclick = () => {
        const channelId = button.getAttribute('data-channel-id');
        currentChannel = channelId; // Update `currentChannel` when switching channels
        loadChannelPeerId(channelId); // Load and set `currentChannelPeerId`
    };
});

// Call initiateVoiceCall only after selecting a channel
initiateVoiceCall();
