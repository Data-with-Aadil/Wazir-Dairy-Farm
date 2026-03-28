import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // FEEDBACK #3

export default function TabLayout() {
  // FEEDBACK #3: Get safe area insets for Android
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: Platform.OS === 'ios' ? 88 : 60 + insets.bottom, // FEEDBACK #3: Add bottom inset for Android
          paddingBottom: Platform.OS === 'ios' ? 32 : insets.bottom, // FEEDBACK #3
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenditure"
        options={{
          title: 'Expenditure',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="milk-sales"
        options={{
          title: 'Milk Sales',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="water" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dls"
        options={{
          title: 'DLS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="lock-closed" size={size} color={color} />
          ),
        }}
      />
      {/* FEEDBACK #12: Investment second-to-last */}
      <Tabs.Screen
        name="investment"
        options={{
          title: 'Investment',
          // FEEDBACK #11: Fixed investment icon (was showing 'close' before)
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      {/* FEEDBACK #12: WRX last */}
      <Tabs.Screen
        name="wrx"
        options={{
          title: 'WRX',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
          tabBarBadge: undefined, // Will add unread count later
        }}
      />
    </Tabs>
  );
}
