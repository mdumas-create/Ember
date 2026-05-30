import 'react-native-gesture-handler';
import './src/utils/i18n'; // Initialize i18n
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ConfigProvider } from './src/context/ConfigContext';
import { Home, Search, MessageCircle, Bell, User } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { Platform, View, useWindowDimensions } from 'react-native';
import api from './src/services/api';
import { ThemeProvider, useThemeMode } from './src/context/ThemeContext';
import * as Sentry from '@sentry/react-native';
import { processQueue } from './src/utils/offlineQueue';
import Sidebar from './src/components/Navigation/Sidebar';
import { navigationRef } from './src/utils/navigation';

if ((process as any)?.env?.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: (process as any).env.EXPO_PUBLIC_SENTRY_DSN,
  });
}

// Placeholder screens
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';
import LegalScreen from './src/screens/Auth/LegalScreen';
import FeedScreen from './src/screens/Feed/FeedScreen';
import PostDetailScreen from './src/screens/Feed/PostDetailScreen';
import ExploreScreen from './src/screens/Explore/ExploreScreen';
import ChatListScreen from './src/screens/Chats/ChatListScreen';
import ChatScreen from './src/screens/Chats/ChatScreen';
import NotificationsScreen from './src/screens/Notifications/NotificationsScreen';
import ProfileScreen from './src/screens/Profile/ProfileScreen';
import EditProfileScreen from './src/screens/Profile/EditProfileScreen';
import SettingsScreen from './src/screens/Profile/SettingsScreen';
import AdminScreen from './src/screens/Profile/AdminScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const linking = {
  prefixes: ['ember://'],
  config: {
    screens: {
      PostDetail: 'post/:postId',
    },
  },
};



function TabNavigator() {
  const { colors } = useThemeMode();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Feed') return <Home color={color} size={size} />;
          if (route.name === 'Explore') return <Search color={color} size={size} />;
          if (route.name === 'Chats') return <MessageCircle color={color} size={size} />;
          if (route.name === 'Notifications') return <Bell color={color} size={size} />;
          if (route.name === 'Profile') return <User color={color} size={size} />;
          return null;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          display: isDesktop ? 'none' : 'flex',
          backgroundColor: colors.navBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Chats" component={ChatListScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function LoggedInApp() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <View style={{ flex: 1, flexDirection: 'row', height: Platform.OS === 'web' ? '100vh' : '100%' }}>
      {isDesktop && <Sidebar />}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="UserProfile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
        </Stack.Navigator>
      </View>
    </View>
  );
}

function Navigation() {
  const { user, loading, updateUser } = useAuth();
  const { ready } = useThemeMode();

  useEffect(() => {
    if (user) {
      processQueue().catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    const register = async () => {
      if (!user) return;
      if (Platform.OS === 'web') return;
      if (user.notifyPush === false) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      let token: string | null = null;
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync();
        token = expoToken.data;
      } catch {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        token = deviceToken.data;
      }
      if (!token) return;
      if (user.fcmToken === token) return;

      const response = await api.put('/users/me', { fcmToken: token });
      await updateUser(response.data);
    };

    register().catch(() => {});
  }, [user?.id, user?.notifyPush]);

  if (loading || !ready) return null;

  return (
    <NavigationContainer linking={linking} ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Root" component={LoggedInApp} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ConfigProvider>
            <Navigation />
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
