import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerForPushNotificationsAsync } from '../app/_layout';

// ✅ Updated to correct backend URL
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

interface User {
  name: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  login: (name: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isOnline: boolean;
  queueOperation: (operation: any) => Promise<void>;
  processPendingOperations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef<any>();

  useEffect(() => {
    loadUser();
    setupNetworkListener();

    if (Platform.OS !== 'web') {
      setupNotifications();
      registerForPushNotifications();
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      processPendingOperations();
    }
  }, [isOnline]);

  useEffect(() => {
    if (expoPushToken && user) {
      sendTokenToBackend(user.name, expoPushToken);
    }
  }, [expoPushToken, user]);

  // ✅ NEW: Sync push token using the exported function from _layout
  useEffect(() => {
    const syncPushToken = async () => {
      if (user && user.name) { // Jab user login ho jaye
        const token = await registerForPushNotificationsAsync();
        if (token) {
          try {
            await fetch(`${BACKEND_URL}/api/auth/update-push-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: user.name, // Backend yahi 'name' mang raha hai
                expo_push_token: token
              }),
            });
            console.log("✅ Push Token Updated for:", user.name);
          } catch (error) {
            console.error("❌ Token sync failed:", error);
          }
        }
      }
    };

    syncPushToken();
  }, [user]); // User login/logout par trigger hoga

  const setupNotifications = async () => {
    try {
      const Notifications = await import('expo-notifications');

      // ✅ CRITICAL: Set up notification channels for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
        });
        console.log('✅ Android notification channel created');
      }

      // Handle foreground notifications
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Listen for received notifications
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('✅ Notification received:', notification);
      });

      console.log('✅ Notification handlers set up');
    } catch (error) {
      console.error('❌ Notification setup error:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  };

  const registerForPushNotifications = async () => {
    if (Platform.OS === 'web') {
      console.log('⚠️ Push notifications not supported on web');
      return;
    }

    try {
      const Notifications = await import('expo-notifications');

      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on physical devices');
        return;
      }

      console.log('🔔 Requesting notification permissions...');

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permission denied');
        return;
      }

      console.log('✅ Notification permission granted');

      // ✅ Using provided Project ID to ensure token generation
      const projectId = "1b758208-fbd5-44ae-a860-d75e4cce3809";

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });

      console.log('✅ Push token obtained:', token.data);
      setExpoPushToken(token.data);
    } catch (error) {
      console.error('❌ Push token error:', error);
    }
  };

  const sendTokenToBackend = async (userName: string, token: string) => {
    try {
      console.log(`📤 Sending token to backend for ${userName}: ${token}`);
      const response = await fetch(`${BACKEND_URL}/api/auth/update-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          expo_push_token: token,
        }),
      });

      if (response.ok) {
        console.log('✅ Token sent to backend successfully');
      } else {
        console.error('❌ Failed to send token:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error sending token to backend:', error);
    }
  };

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Load user error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (name: string, pin: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        
        // If we already have a token, send it immediately after login
        if (expoPushToken) {
          sendTokenToBackend(data.user.name, expoPushToken);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  const queueOperation = async (operation: any) => {
    try {
      const existingQueue = await AsyncStorage.getItem('operationQueue');
      const queue = existingQueue ? JSON.parse(existingQueue) : [];
      queue.push({ ...operation, timestamp: Date.now() });
      await AsyncStorage.setItem('operationQueue', JSON.stringify(queue));
    } catch (error) {
      console.error('Queue error:', error);
    }
  };

  const processPendingOperations = async () => {
    try {
      const queueData = await AsyncStorage.getItem('operationQueue');
      if (!queueData) return;

      const queue = JSON.parse(queueData);
      if (queue.length === 0) return;

      for (const operation of queue) {
        try {
          await fetch(`${BACKEND_URL}${operation.endpoint}`, {
            method: operation.method,
            headers: { 'Content-Type': 'application/json' },
            body: operation.body ? JSON.stringify(operation.body) : undefined,
          });
        } catch (error) {
          console.error('Process op error:', error);
        }
      }

      await AsyncStorage.setItem('operationQueue', JSON.stringify([]));
    } catch (error) {
      console.error('Queue process error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading,
        isOnline,
        queueOperation,
        processPendingOperations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
