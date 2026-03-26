import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';

const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_2ded3f0f-8937-48e9-9afe-e862fe69dea1/artifacts/0vjmy7gj_1000044672.jpg';

export default function LoginScreen() {
  const { user, login, isLoading } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

  const handleLogin = async () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Please select a user');
      return;
    }
    if (pin.length !== 4) {
      Alert.alert('Error', 'Please enter a 4-digit PIN');
      return;
    }

    setLoggingIn(true);
    const success = await login(selectedUser, pin);
    setLoggingIn(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert('Error', 'Invalid PIN');
      setPin('');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: BACKGROUND_IMAGE }}
      style={styles.background}
      blurRadius={3}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Wazir Dairy Farming</Text>
            <Text style={styles.subtitle}>Premium Quality | Pure Buffalo Milk</Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Select User</Text>
            
            <View style={styles.userButtons}>
              <TouchableOpacity
                style={[
                  styles.userButton,
                  selectedUser === 'Aadil' && styles.userButtonActive,
                ]}
                onPress={() => setSelectedUser('Aadil')}
              >
                <Text
                  style={[
                    styles.userButtonText,
                    selectedUser === 'Aadil' && styles.userButtonTextActive,
                  ]}
                >
                  Aadil
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userButton,
                  selectedUser === 'Imran' && styles.userButtonActive,
                ]}
                onPress={() => setSelectedUser('Imran')}
              >
                <Text
                  style={[
                    styles.userButtonText,
                    selectedUser === 'Imran' && styles.userButtonTextActive,
                  ]}
                >
                  Imran
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pinContainer}>
              <Text style={styles.pinLabel}>Enter 4-Digit PIN</Text>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                (!selectedUser || pin.length !== 4) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!selectedUser || pin.length !== 4 || loggingIn}
            >
              {loggingIn ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#D1D5DB',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  loginCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  userButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  userButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  userButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  userButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  userButtonTextActive: {
    color: '#fff',
  },
  pinContainer: {
    marginBottom: 24,
  },
  pinLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  pinInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
    color: '#1F2937',
  },
  loginButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
