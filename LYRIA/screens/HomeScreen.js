import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { auth, db } from '../firebaseConfig'; // Import Firebase Auth and Firestore
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'; // Import the signIn and createUser functions
import { onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { useNavigation } from '@react-navigation/native';

const HomeScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    };

    const handleLogin = async () => {
        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        // Log the email and password for debugging
        console.log('Attempting to log in with:', { email, password });

        try {
            // Attempt to sign in the user
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
            const user = userCredential.user;

            // Handle user authentication and Firestore document creation
            await handleUserAuth(user);

            // Successful login
            navigation.navigate('Chat', { user: { id: user.uid, name: user.displayName || email.split('@')[0] } });

        } catch (error) {
            console.error('Login Error:', error); // Log the error for debugging

            // If the error is that the user does not exist, create a new account
            if (error.code === 'auth/user-not-found') {
                console.log('User not found, attempting to create a new account...'); // Log for debugging
                try {
                    // Create a new user account
                    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
                    const user = userCredential.user;

                    // Create a new user document in Firestore
                    await handleUserAuth(user);

                    // Navigate to the chat after account creation
                    navigation.navigate('Chat', { user: { id: user.uid, name: user.displayName || email.split('@')[0] } });
                } catch (createError) {
                    console.error('Account Creation Error:', createError); // Log the error for debugging
                    Alert.alert('Error', createError.message);
                }
            } else {
                // Show an error alert for other errors
                Alert.alert('Error', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Function to handle user sign-up or login
    const handleUserAuth = async (user) => {
        const userRef = doc(db, 'users', user.uid); // Reference to the user's document

        // Check if the user document exists
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            // Create a new user document if it doesn't exist
            await setDoc(userRef, {
                sender: user.displayName || 'Anonymous', // Set initial sender name
                channels: [], // Initialize with an empty array or add default channels
            });
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in, navigate to the appropriate channel
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userChannels = userData.channels; // Assuming channels is an array of channel IDs

                    if (userChannels.length > 0) {
                        // Navigate to the first channel the user is a member of
                        navigation.navigate('Chat', { channelId: userChannels[0], channelName: 'Your Channel Name' });
                    } else {
                        // Navigate to a default channel if no channels are found
                        navigation.navigate('Chat', { channelId: 'your-default-channel-id', channelName: 'Default Channel' });
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [navigation]);

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.container}>
                <Image 
                    source={require('../assets/logo.png')}
                    style={styles.backgroundImage}
                />
                <Text style={styles.title}>Welcome to Lyria Chat</Text>
                <Text style={styles.subtitle}>Connect with your friends and chat away!</Text>
                
                {/* Input fields for email and password */}
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#dcddde"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none" // Prevent auto-capitalization
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#dcddde"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />
                
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={loading} // Disable button while loading
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.buttonText}>Login</Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => navigation.navigate('Chat', { user: { id: 'guest', name: 'Guest User' } })}
                    >
                        <Text style={styles.buttonText}>Continue as Guest</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#36393f', // Primary background color
        padding: 20,
    },
    backgroundImage: {
        width: 200,
        height: 200,
        marginBottom: 20,
        resizeMode: 'contain'
    },
    title: {
        fontSize: 24,
        color: '#dcddde', // Text color
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#dcddde', // Text color
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        height: 40,
        borderColor: '#5865f2',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        width: '80%',
        marginBottom: 15,
        color: '#dcddde', // Text color
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#5865f2', // Button color
        padding: 15,
        borderRadius: 5,
        width: '80%',
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonText: {
        color: '#ffffff', // Button text color
        fontSize: 16,
    },
});

export default HomeScreen;