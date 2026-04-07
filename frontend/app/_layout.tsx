import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// ✅ Notification handler setup (module level)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ✅ Exported function to register for push notifications
export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    
    // EAS Project ID auto-pick karega
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const setupNotificationHandler = async () => {
      try {
        // ✅ Handle notification clicks (even when app is closed)
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          
          console.log('🔔 Notification Clicked with data:', data);

          // Route based on the data payload from the backend
          if (data?.screen) {
            // Navigate to specific screen provided by backend (e.g., /(tabs)/wrx)
            router.push(data.screen);
          } else if (data?.type === 'event_reminder') {
            // Fallback for older event reminders
            router.push('/(tabs)');
          } else {
            // Default fallback
            router.push('/(tabs)/wrx');
          }
        });

        return () => subscription.remove();
      } catch (error) {
        console.error('❌ Notification listener setup error:', error);
      }
    };

    setupNotificationHandler();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
