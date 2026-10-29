// Native SDK adapter for the same owner-issued bearer invitations used by the website.
import * as Crypto from 'expo-crypto';
import {doc,getDoc,writeBatch,arrayUnion,serverTimestamp} from 'firebase/firestore';
import {db,auth} from './firebaseConfig';
const origin=process.env.EXPO_PUBLIC_SITE_ORIGIN || 'https://lyria.onrender.com';
export async function shareInvitation(id){
 const user=auth.currentUser,room=await getDoc(doc(db,'channels',id)),data=room.data();
 if(!user || !room.exists())throw new Error('Sign in and open a conversation you belong to.');
 if(data.activeInvite){const existing=await getDoc(doc(db,'channelInvites',data.activeInvite));if(existing.exists() && !existing.data().revoked && (!existing.data().expiresAt || existing.data().expiresAt.toMillis()>Date.now()))return origin+'/invite.html?code='+data.activeInvite}
 if(data.createdBy!==user.uid)throw new Error('Ask the conversation owner to create a new link.');
 const code=Array.from(await Crypto.getRandomBytesAsync(16),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),batch=writeBatch(db);
 batch.set(doc(db,'channelInvites',code),{channelId:id,name:data.name || 'Conversation',createdBy:user.uid,createdAt:serverTimestamp(),expiresAt:null,revoked:false});batch.update(doc(db,'channels',id),{activeInvite:code});await batch.commit();return origin+'/invite.html?code='+code;
}
export async function acceptInvitation(value){
 const user=auth.currentUser;if(!user)throw new Error('Sign in first.');let code=value.trim();
 if(/^https?:\/\//i.test(code)){const link=new URL(code);if(link.origin!==origin || !link.pathname.endsWith('/invite.html'))throw new Error('Use a LYRIA invitation link.');code=link.searchParams.get('code') || ''}code=code.toUpperCase();
 if(code==='EVERYONE')return {id:'community',name:'Everyone'};
 if(!/^[A-Z0-9-]{4,64}$/.test(code))throw new Error('Use a valid invitation link or code.');
 const snapshot=await getDoc(doc(db,'channelInvites',code)),invite=snapshot.data();if(!snapshot.exists() || invite.revoked || (invite.expiresAt && invite.expiresAt.toMillis()<=Date.now()))throw new Error('This invitation is no longer available. Ask the owner for a new link.');
 let already=false;try{const room=await getDoc(doc(db,'channels',invite.channelId));already=room.exists() && room.data().members.includes(user.uid)}catch{}
 const batch=writeBatch(db);if(!already)batch.update(doc(db,'channels',invite.channelId),{members:arrayUnion(user.uid),joinInvite:code});batch.set(doc(db,'users',user.uid),{channels:arrayUnion(invite.channelId)},{merge:true});await batch.commit();return {id:invite.channelId,name:invite.name};
}
