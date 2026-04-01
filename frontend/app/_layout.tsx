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

    // Setup notification click handler
    const setupNotificationHandler = async () => {
      try {
        const Notifications = await import('expo-notifications');

        // ✅ Handle notification clicks (even when app is closed)
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;
          const notificationType = data?.type;

          // ✅ FEEDBACK #1: Route based on notification type
          if (notificationType === 'event_reminder') {
            // Event reminders → Dashboard
            router.push('/(tabs)');
          } else {
            // All other activity notifications → WRX tab
            router.push('/(tabs)/wrx');
          }
        });

        return () => subscription.remove();
      } catch (error) {
        console.error('Notification setup error:', error);
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
