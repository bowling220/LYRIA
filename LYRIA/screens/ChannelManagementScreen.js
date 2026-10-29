import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Share } from 'react-native';
import {shareInvitation,acceptInvitation} from '../invitations';
import { db } from '../firebaseConfig';
import { collection, addDoc, query, onSnapshot, doc, updateDoc, setDoc, getDoc, where, writeBatch, arrayUnion } from 'firebase/firestore';
import { auth } from '../firebaseConfig'; // Import auth to get the current user

const ChannelManagementScreen = ({ navigation }) => {
    const [channels, setChannels] = useState([]);
    const [channelName, setChannelName] = useState('');
    const [channelCode, setChannelCode] = useState('');
    const [displayName, setDisplayName] = useState(''); // State for display name

    useEffect(() => {
        const q = query(collection(db, 'channels'),where('members','array-contains',auth.currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const channelData = [];
            snapshot.forEach((doc) => {
                channelData.push({ id: doc.id, ...doc.data() });
            });
            setChannels(channelData);

        });

        return () => unsubscribe();
    }, []);

    const createChannel = async () => {
        if (channelName.trim() === '') {
            Alert.alert('Error', 'Channel name cannot be empty.');
            return;
        }

        try {
            const user=auth.currentUser;if(!user)throw new Error('Sign in first.');
            const ref=doc(collection(db,'channels')),batch=writeBatch(db);
            batch.set(ref,{name:channelName.trim().slice(0,48),createdBy:user.uid,members:[user.uid],isPublic:false});batch.set(doc(db,'users',user.uid),{channels:arrayUnion(ref.id)},{merge:true});await batch.commit();
            setChannelName('');
            Alert.alert('Conversation created', 'Use Share invite to invite your people.');
        } catch (error) {
            console.error('Error creating channel:', error);
        }
    };

    const joinChannel = async (code) => {
        try{const channel=await acceptInvitation(code);setChannelCode('');navigation.navigate('Chat',{channelId:channel.id,channelName:channel.name})}
        catch(error){Alert.alert('Could not join',error.message)}
    };

    const updateDisplayName = async () => {
        const user = auth.currentUser; // Get the current user
        if (!user) {
            Alert.alert('Error', 'You must be logged in to update your display name.');
            return;
        }

        if (displayName.trim() === '') {
            Alert.alert('Error', 'Display name cannot be empty.');
            return;
        }

        try {
            const userRef = doc(db, 'users', user.uid); // Reference to the user's document
            const own=await getDoc(userRef),profile=own.data() || {},name=displayName.trim().slice(0,48),keys=['photoURL','avatarGif','bannerURL','bannerGif','bio','status','showBadges','badges','appearance'];
            const batch=writeBatch(db);batch.set(userRef,{displayName:name},{merge:true});batch.set(doc(db,'profiles',user.uid),{displayName:name,...Object.fromEntries(Object.entries(profile).filter(([key])=>keys.includes(key)))});await batch.commit();
            Alert.alert('Success', 'Display name updated successfully!');
            setDisplayName(''); // Clear the input field after updating
        } catch (error) {
            console.error('Error updating display name:', error);
            Alert.alert('Error', 'Failed to update display name. Please try again.');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Channel Management</Text>
            <TextInput
                style={styles.input}
                placeholder="Channel Name"
                value={channelName}
                onChangeText={setChannelName}
            />
            <TouchableOpacity style={styles.button} onPress={createChannel}>
                <Text style={styles.buttonText}>Create Channel</Text>
            </TouchableOpacity>
            <TextInput
                style={styles.input}
                placeholder="Enter Channel Code to Join"
                value={channelCode}
                onChangeText={setChannelCode}
            />
            <TouchableOpacity style={styles.button} onPress={() => joinChannel(channelCode)}>
                <Text style={styles.buttonText}>Join Channel</Text>
            </TouchableOpacity>
            <TextInput
                style={styles.input}
                placeholder="Enter Display Name"
                value={displayName}
                onChangeText={setDisplayName}
            />
            <TouchableOpacity style={styles.button} onPress={updateDisplayName}>
                <Text style={styles.buttonText}>Update Display Name</Text>
            </TouchableOpacity>
            <FlatList
                data={channels}
                renderItem={({ item }) => (
                    <View style={styles.channelItem}>
                        <Text style={styles.channelName}>{item.name}</Text>
                        <TouchableOpacity onPress={()=>navigation.navigate('Chat',{channelId:item.id,channelName:item.name})}><Text style={styles.channelCode}>Open conversation</Text></TouchableOpacity>
                        <TouchableOpacity onPress={async()=>{try{await Share.share({message:await shareInvitation(item.id)})}catch(error){Alert.alert('Could not share',error.message)}}}><Text style={styles.channelCode}>Share invite</Text></TouchableOpacity>
                    </View>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.channelList}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#36393f',
    },
    title: {
        fontSize: 24,
        color: '#dcddde',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        height: 50,
        borderColor: '#5865f2',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 15,
        color: '#dcddde',
    },
    button: {
        backgroundColor: '#5865f2',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 15,
    },
    buttonText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    channelItem: {
        backgroundColor: '#40444b',
        padding: 15,
        marginVertical: 5,
        borderRadius: 10,
    },
    channelName: {
        color: '#5865f2',
        fontWeight: 'bold',
    },
    channelCode: {
        color: '#dcddde',
    },
    channelList: {
        paddingBottom: 20,
    },
});

export default ChannelManagementScreen;
