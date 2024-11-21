import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import ChannelManagementScreen from './screens/ChannelManagementScreen';

const Stack = createStackNavigator();

const App = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator 
                initialRouteName="Home"
                screenOptions={{
                    headerShown: false
                }}
            >
                <Stack.Screen 
                    name="Home" 
                    component={HomeScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen 
                    name="Chat" 
                    component={ChatScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen 
                    name="ChannelManagement" 
                    component={ChannelManagementScreen}
                    options={{ headerShown: false }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default App;
