import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const BACKEND_URL = "https://wazir-dairy-farm.onrender.com";

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

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string>('');

  useEffect(() => {
    loadUser();
    setupNetworkListener();
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    if (isOnline) {
      processPendingOperations();
    }
  }, [isOnline]);

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  };

  const registerForPushNotifications = async () => {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notifications');
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      setExpoPushToken(token.data);
    } catch (error) {
      console.error('Error getting push token:', error);
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
      console.error('Error loading user:', error);
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

        // Update push token in backend
        if (expoPushToken) {
          await fetch(`${BACKEND_URL}/api/auth/update-push-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, expo_push_token: expoPushToken }),
          });
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
      console.error('Error queuing operation:', error);
    }
  };

  const processPendingOperations = async () => {
    try {
      const queueData = await AsyncStorage.getItem('operationQueue');
      if (!queueData) return;

      const queue = JSON.parse(queueData);
      if (queue.length === 0) return;

      console.log(`Processing ${queue.length} pending operations...`);

      for (const operation of queue) {
        try {
          await fetch(`${BACKEND_URL}${operation.endpoint}`, {
            method: operation.method,
            headers: { 'Content-Type': 'application/json' },
            body: operation.body ? JSON.stringify(operation.body) : undefined,
          });
        } catch (error) {
          console.error('Error processing operation:', error);
        }
      }

      // Clear queue after processing
      await AsyncStorage.setItem('operationQueue', JSON.stringify([]));
    } catch (error) {
      console.error('Error processing pending operations:', error);
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
