let peer;
let localStream;
let currentCall;

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

            // Log the peer ID for sharing
            console.log('Your peer ID is: ' + peer.id);
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
        });
}

// Function to call another peer
function callPeer(peerId) {
    if (localStream) {
        const call = peer.call(peerId, localStream);
        call.on('stream', (remoteStream) => {
            // Play the remote audio stream
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play();
        });
    } else {
        console.error('Local stream is not available.');
    }
}

// Event listener for the voice call button
document.getElementById('make-voice-call').addEventListener('click', () => {
    const peerId = prompt('Enter the peer ID to call:');
    if (peerId) {
        callPeer(peerId);
    }
});

// Start the peer connection when the page loads
window.onload = initiateVoiceCall;