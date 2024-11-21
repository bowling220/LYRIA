// LYRIA/screens/ChatScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { db, auth } from '../firebaseConfig'; // Import the initialized Firestore and Auth
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

const ChatScreen = ({ route, navigation }) => {
    const { channelId, channelName } = route.params || {}; // Ensure params are defined
    const [messages, setMessages] = useState([]); // Initialize messages as an empty array
    const [newMessage, setNewMessage] = useState('');

    useEffect(() => {
        if (!channelId) {
            console.error('Channel ID is undefined');
            return; // Exit if channelId is not defined
        }

        // Subscribe to messages collection for the specific channel
        const q = query(collection(db, 'channels', channelId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messageData = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // Ensure the message has the expected structure
                if (data.message && data.sender && data.timestamp) {
                    messageData.push({ id: doc.id, ...data });
                } else {
                    console.warn("Message missing required fields:", data);
                }
            });
            setMessages(messageData);
        }, (error) => {
            console.error("Error fetching messages:", error); // Log any errors
        });

        return () => unsubscribe();
    }, [channelId]);

    const sendMessage = async () => {
        const user = auth.currentUser; // Get the current user
        if (!user) {
            Alert.alert('Error', 'You must be logged in to send messages.');
            return; // Exit if user is not authenticated
        }

        if (newMessage.trim()) {
            try {
                // Add the message to the Firestore collection for the specific channel
                await addDoc(collection(db, 'channels', channelId, 'messages'), {
                    message: newMessage, // Use the correct field name for the message
                    sender: user.displayName || 'Anonymous', // Use the display name as sender
                    timestamp: Timestamp.now() // Use Firestore's Timestamp
                });
                setNewMessage(''); // Clear the input field after sending
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    };

    const renderMessage = ({ item }) => {
        return (
            <View style={[styles.messageContainer, item.sender === auth.currentUser?.displayName ? styles.sentMessage : styles.receivedMessage]}>
                <Text style={styles.userName}>{item.sender}</Text> {/* Display the sender */}
                <Text style={styles.messageText}>{item.message}</Text> {/* Use the correct field name for the message */}
                <Text style={styles.timestampText}>{new Date(item.timestamp.seconds * 1000).toLocaleString()}</Text> {/* Format timestamp */}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.channelTitle}>{channelName || 'Channel'}</Text>
                <TouchableOpacity 
                    style={styles.managementButton} 
                    onPress={() => navigation.navigate('ChannelManagement')}
                >
                    <Text style={styles.managementButtonText}>Manage Channels</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
            />
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#36393f'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#40444b',
        marginTop: 25,
    },
    channelTitle: {
        fontSize: 20,
        color: '#dcddde',
        marginTop: 20,
    },
    managementButton: {
        backgroundColor: '#5865f2',
        padding: 10,
        borderRadius: 5,
    },
    managementButtonText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    messagesList: {
        flex: 1,
        padding: 10
    },
    messageContainer: {
        padding: 10,
        marginVertical: 5,
        borderRadius: 5,
        maxWidth: '80%', // Limit the width of the message bubble
    },
    sentMessage: {
        backgroundColor: '#5865f2',
        alignSelf: 'flex-end', // Align sent messages to the right
    },
    receivedMessage: {
        backgroundColor: '#40444b',
        alignSelf: 'flex-start', // Align received messages to the left
    },
    userName: {
        color: '#ffffff',
        fontWeight: 'bold',
        marginBottom: 5
    },
    messageText: {
        color: '#dcddde'
    },
    timestampText: {
        color: '#999',
        fontSize: 12,
        marginTop: 5
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        backgroundColor: '#40444b'
    },
    input: {
        flex: 1,
        backgroundColor: '#36393f',
        color: '#dcddde',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 10
    },
    sendButton: {
        backgroundColor: '#5865f2',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        justifyContent: 'center'
    },
    sendButtonText: {
        color: '#ffffff',
        fontWeight: 'bold'
    }
});

export default ChatScreen;