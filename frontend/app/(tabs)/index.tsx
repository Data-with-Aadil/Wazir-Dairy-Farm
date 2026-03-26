import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { router } from 'expo-router';

const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_2ded3f0f-8937-48e9-9afe-e862fe69dea1/artifacts/0vjmy7gj_1000044672.jpg';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DashboardStats {
  total_investment: number;
  aadil_investment: number;
  imran_investment: number;
  total_earnings: number;
  total_expenditure: number;
  net_profit: number;
  total_dls: number;
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
    setupUsers(); // Initialize users on first load
  }, []);

  const setupUsers = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/setup`, { method: 'POST' });
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ImageBackground
      source={{ uri: BACKGROUND_IMAGE }}
      style={styles.background}
      blurRadius={50}
    >
      <View style={styles.overlay}>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Investment Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Investment (Yearly)</Text>
            <Text style={styles.mainValue}>₹{stats?.total_investment.toLocaleString('en-IN') || '0'}</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Aadil</Text>
                <Text style={styles.statValue}>₹{stats?.aadil_investment.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Imran</Text>
                <Text style={styles.statValue}>₹{stats?.imran_investment.toLocaleString('en-IN') || '0'}</Text>
              </View>
            </View>
          </View>

          {/* Monthly Metrics Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Metrics</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Ionicons name="trending-up" size={20} color="#10B981" />
                <Text style={styles.metricLabel}>Earnings</Text>
                <Text style={styles.metricValue}>₹{stats?.total_earnings.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="trending-down" size={20} color="#EF4444" />
                <Text style={styles.metricLabel}>Expenditure</Text>
                <Text style={styles.metricValue}>₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="cash" size={20} color="#3B82F6" />
                <Text style={styles.metricLabel}>Net Profit</Text>
                <Text style={[styles.metricValue, { color: (stats?.net_profit || 0) >= 0 ? '#10B981' : '#EF4444' }]}>
                  ₹{stats?.net_profit.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dairy Lock Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dairy Lock Sales</Text>
            <Text style={styles.mainValue}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
            <Text style={styles.cardSubtitle}>Total Actual Payments Received</Text>
          </View>

          {/* Charts Placeholder */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Earnings vs Expenditure</Text>
            <Text style={styles.chartPlaceholder}>Chart will be added in next phase</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Investment Distribution</Text>
            <Text style={styles.chartPlaceholder}>Pie chart will be added in next phase</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  logoutButton: {
    padding: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  mainValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  chartPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
