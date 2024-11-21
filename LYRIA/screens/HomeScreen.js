import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';

const HomeScreen = ({ navigation }) => {
    const handleGuestLogin = () => {
        // Simulate guest login
        const guestUser = { id: 'guest', name: 'Guest User' };
        // You can store this user in your app's state or AsyncStorage
        navigation.navigate('Chat', { user: guestUser }); // Pass guest user to Chat screen
    };

    return (
        <View style={styles.container}>
            <Image 
                source={require('../assets/logo.png')}
                style={styles.backgroundImage}
            />
            <Text style={styles.title}>Welcome to Lyria Chat</Text>
            <Text style={styles.subtitle}>Connect with your friends and chat away!</Text>
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.button}
                    onPress={handleGuestLogin}
                >
                    <Text style={styles.buttonText}>Continue as Guest</Text>
                </TouchableOpacity>
            </View>
        </View>
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
