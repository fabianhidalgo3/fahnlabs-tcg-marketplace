import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/auth';
import { T } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import ScanScreen from './src/screens/ScanScreen';
import SinglesScreen from './src/screens/SinglesScreen';
import CardDetailScreen from './src/screens/CardDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: T.bg,
    card: T.card,
    border: T.border,
    text: T.text,
    primary: T.primary,
  },
};

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: T.card },
        headerTitleStyle: { color: T.text, fontWeight: '800' },
        tabBarStyle: { backgroundColor: T.card, borderTopColor: T.border },
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.muted,
      }}
    >
      <Tab.Screen name="Inicio" component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }} />
      <Tab.Screen name="Colección" component={CollectionScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🗂" focused={focused} /> }} />
      <Tab.Screen name="Escanear" component={ScanScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="📷" focused={focused} /> }} />
      <Tab.Screen name="Singles" component={SinglesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🛒" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Carta" component={CardDetailScreen}
              options={{
                title: 'Carta',
                headerStyle: { backgroundColor: T.card },
                headerTintColor: T.text,
              }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}
