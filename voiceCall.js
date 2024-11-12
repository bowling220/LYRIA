let peer;
let localStream;
let currentCall;
let currentChannelPeerId; // Stores the peer ID for the current channel

// Function to initiate a voice call
function initiateVoiceCall() {
    // Create a new Peer instance
    peer = new Peer();

    // Get user media (audio)
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            localStream = stream;

            // Listen for incoming calls
            peer.on('call', (call) => {
                // Answer the call with the local stream
                call.answer(localStream);
                call.on('stream', (remoteStream) => {
                    // Play the remote audio stream
                    const remoteAudio = document.createElement('audio');
                    remoteAudio.srcObject = remoteStream;
                    remoteAudio.play();
                });
            });

            // Log the peer ID for sharing and set up channel-specific connections
            console.log('Your peer ID is: ' + peer.id);

            // Set the peer ID for the selected channel
            // This example assumes a `setChannelPeerId` function exists to set the peer ID for each channel
            setChannelPeerId(peer.id);
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
}

// Function to call another peer in the selected channel
function callPeerInChannel() {
    if (localStream && currentChannelPeerId) {
        const call = peer.call(currentChannelPeerId, localStream);
        call.on('stream', (remoteStream) => {
            // Play the remote audio stream
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play();
        });
    } else {
        console.error('Local stream or channel peer ID is not available.');
    }
}

// Event listener for the voice call button in the selected chat channel
document.getElementById('make-voice-call').addEventListener('click', () => {
    callPeerInChannel(); // Automatically calls the peer ID of the current channel
});

// Example function to update the channel-specific peer ID
function setChannelPeerId(peerId) {
    // Assuming you have a mechanism to set the `currentChannelPeerId` dynamically
    currentChannelPeerId = peerId; // Replace this with actual channel selection logic
}
