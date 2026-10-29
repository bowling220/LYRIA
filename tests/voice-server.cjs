const {PeerServer}=require('peer');
const {Server}=require('ws');
PeerServer({host:'127.0.0.1',port:Number(process.argv[2]),path:'/voice',createWebSocketServer:options=>new Server(options)});
