File: /app/(tabs)/index.tsx

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
import { Picker } from '@react-native-picker/picker';

const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
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

interface DLS {
  date: string;
  amount: number;
  month: number;
  year: number;
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [currentMonthDLS, setCurrentMonthDLS] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [reminderOption, setReminderOption] = useState('none');
  const [addingEvent, setAddingEvent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const scrollViewRef = React.useRef<ScrollView>(null);

  const REMINDER_OPTIONS = [
    { label: 'No Reminder', value: 'none' },
    { label: 'Remind after 15 days', value: '15_days' },
    { label: 'Remind after 1 month', value: '1_month' },
    { label: 'Remind after 3 months', value: '3_months' },
    { label: 'Remind after 6 months', value: '6_months' },
    { label: 'Remind after 1 year', value: '1_year' },
  ];

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      fetchStats();
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

  const fetchDLS = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales`);
      if (response.ok) {
        const data = await response.json();
        setDlsList(data);

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
          reminder: reminderOption !== 'none' ? reminderOption : undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Event added successfully');
        setEventModalVisible(false);
        setEventDescription('');
        setSelectedDate('');
        setReminderOption('none');
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
    await Promise.all([fetchStats(), fetchDLS(), fetchEvents()]);
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
          // Force navigation immediately
          router.replace('/');
        },
      },
    ]);
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const netDLS = (stats?.total_dls || 0) - (stats?.total_expenditure || 0);

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
  </style>
</head>
<body>
  <h1>Wazir Dairy Farming - Dashboard Report</h1>
  <p style="text-align: center; color: #6B7280;">Generated on ${new Date().toLocaleDateString()}</p>
  
  <div class="section">
    <h2>Total Investment</h2>
    <div class="row"><span class="label">Total:</span><span class="value">₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</span></div>
    <div class="row"><span class="label">Aadil:</span><span class="value">₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</span></div>
    <div class="row"><span class="label">Imran:</span><span class="value">₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</span></div>
  </div>

  <div class="section">
    <h2>Net DLS</h2>
    <div class="row"><span class="label">Total DLS:</span><span class="value">₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</span></div>
    <div class="row"><span class="label">Total Expenditure:</span><span class="value">₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</span></div>
    <div class="row"><span class="label">Net DLS:</span><span class="value">₹${netDLS.toLocaleString('en-IN')}</span></div>
  </div>
</body>
</html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      Alert.alert('PDF Generated', 'Would you like to share it?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri);
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  // Filter events by selected month
  const filteredEvents = events.filter(event => event.date.startsWith(selectedMonth));

  // Get reminder dates for red dots
  const reminderDates = events
    .filter(event => event.reminder_date)
    .reduce((acc: any, event: any) => {
      acc[event.reminder_date] = {
        marked: true,
        dotColor: '#EF4444',
        customStyles: {
          container: { backgroundColor: '#FEE2E2' },
        },
      };
      return acc;
    }, {});

  const netDLS = (stats?.total_dls || 0) - (stats?.total_expenditure || 0);

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

          {/* First Row: Investment and Net DLS */}
          <View style={styles.rowCards}>
            {/* Investment Card */}
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.cardTitle}>Total Investment</Text>
              <Text style={styles.mainValue} numberOfLines={1}>₹{stats?.total_investment.toLocaleString('en-IN') || '0'}</Text>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Aadil</Text>
                  <Text style={styles.statValue} numberOfLines={1}>₹{stats?.aadil_investment.toLocaleString('en-IN') || '0'}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Imran</Text>
                  <Text style={styles.statValue} numberOfLines={1}>₹{stats?.imran_investment.toLocaleString('en-IN') || '0'}</Text>
                </View>
              </View>
            </View>

            {/* Net DLS Card */}
            <View style={[styles.card, styles.halfCard]}>
              <Text style={styles.cardTitle}>Net DLS</Text>
              <Text style={[styles.mainValue, { color: netDLS >= 0 ? '#10B981' : '#EF4444' }]} numberOfLines={1}>
                ₹{netDLS.toLocaleString('en-IN')}
              </Text>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Total DLS</Text>
                  <Text style={styles.statValue} numberOfLines={1}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Expenditure</Text>
                  <Text style={styles.statValue} numberOfLines={1}>₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Monthly Performance Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            <View style={styles.performanceRow}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Total DLS</Text>
                <Text style={styles.performanceValue} numberOfLines={1}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>This Month</Text>
                <Text style={styles.performanceValue} numberOfLines={1}>₹{currentMonthDLS.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Monthly Profit</Text>
                <Text style={[styles.performanceValue, { color: (currentMonthDLS - (stats?.total_expenditure || 0)) >= 0 ? '#10B981' : '#EF4444' }]} numberOfLines={1}>
                  ₹{(currentMonthDLS - (stats?.total_expenditure || 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Event Calendar */}
          <View style={styles.card}>
            <View style={styles.calendarHeader}>
              <Text style={styles.cardTitle}>Event Calendar</Text>
            </View>
            <Calendar
              markedDates={{
                ...events.reduce((acc: any, event: any) => {
                  acc[event.date] = {
                    marked: true,
                    dotColor: '#10B981',
                  };
                  return acc;
                }, {}),
                ...reminderDates,
                [selectedDate]: {
                  selected: true,
                  selectedColor: '#10B981',
                },
              }}
              onDayPress={(day: any) => {
                setSelectedDate(day.dateString);
                setEventModalVisible(true);
              }}
              onMonthChange={(month: any) => {
                setSelectedMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
              }}
              theme={{
                selectedDayBackgroundColor: '#10B981',
                todayTextColor: '#10B981',
                arrowColor: '#10B981',
              }}
            />

            {/* Event List for selected month */}
            <View style={styles.eventList}>
              <Text style={styles.eventListTitle}>Events in {selectedMonth}</Text>
              {filteredEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events this month</Text>
              ) : (
                filteredEvents.map((event: any) => (
                  <View key={event._id} style={styles.eventItem}>
                    <View style={styles.eventDot} />
                    <View style={styles.eventContent}>
                      <Text style={styles.eventDate}>{event.date}</Text>
                      <Text style={styles.eventDesc}>{event.description}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await fetch(`${BACKEND_URL}/api/events/${event._id}`, { method: 'DELETE' });
                          fetchEvents();
                        } catch (error) {
                          Alert.alert('Error', 'Failed to delete event');
                        }
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        {/* Event Add Modal */}
        <Modal visible={eventModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEventModalVisible(false)}>
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

              <View style={styles.formGroup}>
                <Text style={styles.label}>Reminder</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={reminderOption} onValueChange={setReminderOption} style={styles.picker}>
                    {REMINDER_OPTIONS.map((option) => (
                      <Picker.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, addingEvent && styles.submitButtonDisabled]}
                onPress={handleAddEvent}
                disabled={addingEvent}
              >
                {addingEvent ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Add Event</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 48, marginBottom: 24 },
  greeting: { fontSize: 14, color: '#6B7280' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  exportButton: { padding: 8, backgroundColor: '#F0FDF4', borderRadius: 8 },
  logoutButton: { padding: 8 },
  rowCards: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  halfCard: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 10 },
  mainValue: { fontSize: 24, fontWeight: '700', color: '#10B981' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  performanceRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  performanceItem: { alignItems: 'center', flex: 1 },
  performanceLabel: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
  performanceValue: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  calendarHeader: { marginBottom: 16 },
  eventList: { marginTop: 16 },
  eventListTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  noEvents: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
  eventItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 12 },
  eventContent: { flex: 1 },
  eventDate: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  eventDesc: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  eventModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: '#1F2937' },
  pickerContainer: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  picker: { height: 50 },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
