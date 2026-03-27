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
        
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const screen = response.notification.request.content.data?.screen;
          
          // Navigate to WRX tab when notification is clicked
          if (screen === 'wrx') {
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
