/* Deployment supplies a browser-scoped credentials URL; never use a Metered secretKey here. */
window.LYRIA_VOICE_CONFIG={
  iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}],
  credentialsUrl:'',
  ...window.LYRIA_VOICE_CONFIG
};
