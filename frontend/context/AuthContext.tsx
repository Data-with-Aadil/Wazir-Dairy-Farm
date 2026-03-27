import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
const [user, setUser] = useState<User | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [isOnline, setIsOnline] = useState(true);
const [expoPushToken, setExpoPushToken] = useState<string>('');

useEffect(() => {
loadUser();
setupNetworkListener();

```
if (Platform.OS !== 'web') {
  setupNotifications();
  registerForPushNotifications();
}
```

}, []);

useEffect(() => {
if (isOnline) {
processPendingOperations();
}
}, [isOnline]);

const setupNotifications = async () => {
const Notifications = await import('expo-notifications');

```
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

};

const setupNetworkListener = () => {
const unsubscribe = NetInfo.addEventListener(state => {
setIsOnline(state.isConnected ?? false);
});
return unsubscribe;
};

const registerForPushNotifications = async () => {
if (Platform.OS === 'web') return;

```
const Notifications = await import('expo-notifications');

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
    console.log('Failed to get push token');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  setExpoPushToken(token.data);
} catch (error) {
  console.error('Push token error:', error);
}
```

};

const loadUser = async () => {
try {
const userData = await AsyncStorage.getItem('user');
if (userData) {
setUser(JSON.parse(userData));
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

```
  if (response.ok) {
    const data = await response.json();
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);

    if (expoPushToken) {
      await fetch(`${BACKEND_URL}/api/auth/update-push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          expo_push_token: expoPushToken,
        }),
      });
    }

    return true;
  }

  return false;
} catch (error) {
  console.error('Login error:', error);
  return false;
}
```

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

```
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
```

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
