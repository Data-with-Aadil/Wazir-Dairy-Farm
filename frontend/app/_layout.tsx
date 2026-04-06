import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const setupNotificationHandler = async () => {
      try {
        const Notifications = await import('expo-notifications');

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
