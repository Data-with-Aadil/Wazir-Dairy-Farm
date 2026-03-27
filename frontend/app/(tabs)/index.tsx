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
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const BACKGROUND_IMAGE = {
  uri: "https://customer-assets.emergentagent.com/job_2ded3f0f-8937-48e9-9afe-e862fe69dea1/artifacts/0vjmy7gj_1000044672.jpg"
};
const BACKEND_URL = "https://wazir-dairy-farm.onrender.com";

interface DashboardStats {
  total_investment: number;
  aadil_investment: number;
  imran_investment: number;
  total_earnings: number;
  total_expenditure: number;
  net_profit: number;
  total_dls: number;
}

interface MilkSale {
  date: string;
  earnings: number;
}

interface Expenditure {
  date: string;
  amount: number;
}

interface DLS {
  date: string;
  amount: number;
  month: number;
  year: number;
}

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [milkSales, setMilkSales] = useState<MilkSale[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [currentMonthDLS, setCurrentMonthDLS] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Scroll to top when tab is focused
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      // Also refresh data when dashboard is focused
      fetchStats();
      fetchChartData();
      fetchDLS();
      fetchEvents();
    }, [])
  );

  useEffect(() => {
    setupUsers();
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

  const fetchChartData = async () => {
    try {
      const [salesRes, expendRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/milk-sales`),
        fetch(`${BACKEND_URL}/api/expenditures`),
      ]);

      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setMilkSales(salesData);
      }

      if (expendRes.ok) {
        const expendData = await expendRes.json();
        setExpenditures(expendData);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const fetchDLS = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales`);
      if (response.ok) {
        const data = await response.json();
        setDlsList(data);

        // Calculate current month DLS
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const currentMonthTotal = data
          .filter((dls: DLS) => dls.month === currentMonth && dls.year === currentYear)
          .reduce((sum: number, dls: DLS) => sum + dls.amount, 0);

        setCurrentMonthDLS(currentMonthTotal);
      }
    } catch (error) {
      console.error('Error fetching DLS:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleAddEvent = async () => {
    if (!eventDescription.trim() || !selectedDate) {
      Alert.alert('Error', 'Please select a date and enter description');
      return;
    }

    setAddingEvent(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          description: eventDescription.substring(0, 15),
          created_by: user?.name,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Event added successfully');
        setEventModalVisible(false);
        setEventDescription('');
        setSelectedDate('');
        fetchEvents();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add event');
    } finally {
      setAddingEvent(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchChartData(), fetchDLS(), fetchEvents()]);
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

  const exportToPDF = async () => {
    try {
      setExporting(true);

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #10B981; text-align: center; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #E5E7EB; border-radius: 8px; }
    .row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { font-weight: bold; color: #6B7280; }
    .value { color: #1F2937; }
    .footer { text-align: center; margin-top: 40px; color: #9CA3AF; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Wazir Dairy Farming - Dashboard Report</h1>
  <p style="text-align: center; color: #6B7280;">Generated on ${new Date().toLocaleDateString()}</p>

  <div class="section">
    <h2>Total Investment</h2>
    <div class="row">
      <span class="label">Total:</span>
      <span class="value">₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</span>
    </div>
    <div class="row">
      <span class="label">Aadil:</span>
      <span class="value">₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</span>
    </div>
    <div class="row">
      <span class="label">Imran:</span>
      <span class="value">₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Monthly Performance</h2>
    <div class="row">
      <span class="label">Earnings:</span>
      <span class="value">₹${stats?.total_earnings.toLocaleString('en-IN') || '0'}</span>
    </div>
    <div class="row">
      <span class="label">Expenditure:</span>
      <span class="value">₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</span>
    </div>
    <div class="row">
      <span class="label">Net Profit:</span>
      <span class="value">₹${stats?.net_profit.toLocaleString('en-IN') || '0'}</span>
    </div>
  </div>

  <div class="section">
    <h2>Dairy Lock Sales</h2>
    <div class="row">
      <span class="label">Total:</span>
      <span class="value">₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</span>
    </div>
    <div class="row">
      <span class="label">Current Month:</span>
      <span class="value">₹${currentMonthDLS.toLocaleString('en-IN')}</span>
    </div>
  </div>

  <div class="footer">
    <p>Wazir Dairy Farming © 2026</p>
  </div>
</body>
</html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      Alert.alert(
        'PDF Generated',
        'Dashboard report has been created. Would you like to share it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={exportToPDF} style={styles.exportButton}>
                <Ionicons name="download-outline" size={24} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Investment Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Investment</Text>
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

          {/* Monthly Performance Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
                <Text style={styles.metricLabel}>Earnings</Text>
                <Text style={styles.metricValue}>₹{stats?.total_earnings.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="trending-down" size={24} color="#EF4444" />
                <Text style={styles.metricLabel}>Expenditure</Text>
                <Text style={styles.metricValue}>₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="cash" size={24} color="#3B82F6" />
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
            <View style={styles.dlsContainer}>
              <View style={styles.dlsItem}>
                <Text style={styles.dlsLabel}>Total</Text>
                <Text style={styles.dlsValue}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.dlsDivider} />
              <View style={styles.dlsItem}>
                <Text style={styles.dlsLabel}>This Month</Text>
                <Text style={styles.dlsMonthValue}>₹{currentMonthDLS.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.dlsDivider} />
              <View style={styles.dlsItem}>
                <Text style={styles.dlsLabel}>Actual Monthly Profit</Text>
                <Text style={[styles.dlsNetProfit, { color: (currentMonthDLS - (stats?.total_expenditure || 0)) >= 0 ? '#10B981' : '#EF4444' }]}>
                  ₹{(currentMonthDLS - (stats?.total_expenditure || 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Event Calendar */}
          <View style={styles.card}>
            <View style={styles.calendarHeader}>
              <Text style={styles.cardTitle}>Event Calendar</Text>
              <TouchableOpacity
                onPress={() => setEventModalVisible(true)}
                style={styles.addEventButton}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <Calendar
              markedDates={{
                ...events.reduce((acc: any, event: any) => {
                  acc[event.date] = {
                    marked: true,
                    dotColor: '#10B981',
                    customStyles: {
                      container: {
                        backgroundColor: '#F0FDF4',
                      },
                    },
                  };
                  return acc;
                }, {}),
                [selectedDate]: {
                  selected: true,
                  selectedColor: '#10B981',
                },
              }}
              onDayPress={(day: any) => {
                setSelectedDate(day.dateString);
                setEventModalVisible(true);
              }}
              theme={{
                selectedDayBackgroundColor: '#10B981',
                todayTextColor: '#10B981',
                arrowColor: '#10B981',
              }}
            />

            {/* Event List */}
            <View style={styles.eventList}>
              {events.map((event: any) => (
                <View key={event._id} style={styles.eventItem}>
                  <View style={styles.eventDot} />
                  <View style={styles.eventContent}>
                    <Text style={styles.eventDate}>{event.date}</Text>
                    <Text style={styles.eventDesc}>{event.description}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await fetch(`${BACKEND_URL}/api/events/${event._id}`, {
                          method: 'DELETE',
                        });
                        fetchEvents();
                      } catch (error) {
                        Alert.alert('Error', 'Failed to delete event');
                      }
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Event Add Modal */}
        <Modal
          visible={eventModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEventModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.eventModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Event</Text>
                <TouchableOpacity onPress={() => setEventModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Date: {selectedDate || 'Select a date'}</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Event Description ({eventDescription.length}/15)</Text>
                <TextInput
                  style={styles.input}
                  value={eventDescription}
                  onChangeText={(text) => setEventDescription(text.substring(0, 15))}
                  placeholder="e.g., Deworming"
                  maxLength={15}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, addingEvent && styles.submitButtonDisabled]}
                onPress={handleAddEvent}
                disabled={addingEvent}
              >
                {addingEvent ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  mainValue: {
    fontSize: 24,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
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
  dlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dlsItem: {
    flex: 1,
    alignItems: 'center',
  },
  dlsDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  dlsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  dlsMonthValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },
  dlsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  dlsNetProfit: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addEventButton: {
    backgroundColor: '#10B981',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventList: {
    marginTop: 16,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  eventModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
