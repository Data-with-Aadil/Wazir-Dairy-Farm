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

// FEEDBACK #2: Updated to use local image path
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
  const [events, setEvents] = useState([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [reminder, setReminder] = useState('none'); // FEEDBACK #6: Add reminder option
  const [addingEvent, setAddingEvent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // FEEDBACK #6: Track selected month
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

  // FEEDBACK #6: Calculate reminder date based on selection
  const calculateReminderDate = (eventDate: string, reminderType: string): string | undefined => {
    if (reminderType === 'none') return undefined;
    
    const date = new Date(eventDate);
    switch (reminderType) {
      case '15_days':
        date.setDate(date.getDate() - 15);
        break;
      case '1_month':
        date.setMonth(date.getMonth() - 1);
        break;
      case '3_months':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6_months':
        date.setMonth(date.getMonth() - 6);
        break;
      case '1_year':
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        return undefined;
    }
    return date.toISOString().split('T')[0];
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
          reminder: reminder !== 'none' ? reminder : undefined, // FEEDBACK #6
          reminder_date: calculateReminderDate(selectedDate, reminder), // FEEDBACK #6
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Event added successfully');
        setEventModalVisible(false);
        setEventDescription('');
        setSelectedDate('');
        setReminder('none');
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

  // FEEDBACK #4: Immediate logout with router.replace
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/'); // Use replace instead of push
        },
      },
    ]);
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #10B981; }
              .section { margin: 20px 0; }
              .row { display: flex; justify-content: space-between; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>Wazir Dairy Farming - Dashboard Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
            
            <div class="section">
              <h2>Total Investment</h2>
              <div class="row"><strong>Total:</strong> ₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</div>
              <div class="row"><strong>Aadil:</strong> ₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</div>
              <div class="row"><strong>Imran:</strong> ₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</div>
            </div>
            
            <div class="section">
              <h2>Monthly Performance</h2>
              <div class="row"><strong>Earnings:</strong> ₹${stats?.total_earnings.toLocaleString('en-IN') || '0'}</div>
              <div class="row"><strong>Expenditure:</strong> ₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</div>
              <div class="row"><strong>Net Profit:</strong> ₹${stats?.net_profit.toLocaleString('en-IN') || '0'}</div>
            </div>
            
            <div class="section">
              <h2>Dairy Lock Sales</h2>
              <div class="row"><strong>Total:</strong> ₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</div>
              <div class="row"><strong>Current Month:</strong> ₹${currentMonthDLS.toLocaleString('en-IN')}</div>
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

  // FEEDBACK #6: Filter events by selected month
  const filteredEvents = events.filter((event: any) => {
    const eventMonth = event.date.substring(0, 7);
    return eventMonth === selectedMonth;
  });

  // FEEDBACK #7: Calculate Net DLS
  const netDLS = (stats?.total_dls || 0) - (stats?.total_expenditure || 0);

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

          {/* FEEDBACK #7: Investment and Net DLS Cards Side by Side */}
          <View style={styles.twoColumnRow}>
            {/* Total Investment Card */}
            <View style={styles.halfCard}>
              <Text style={styles.cardTitle}>Total Investment</Text>
              <Text style={[styles.mainValue, styles.noWrap]}>₹{stats?.total_investment.toLocaleString('en-IN') || '0'}</Text>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Aadil</Text>
                  <Text style={[styles.statValue, styles.noWrap]}>₹{stats?.aadil_investment.toLocaleString('en-IN') || '0'}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Imran</Text>
                  <Text style={[styles.statValue, styles.noWrap]}>₹{stats?.imran_investment.toLocaleString('en-IN') || '0'}</Text>
                </View>
              </View>
            </View>

            {/* FEEDBACK #7: Net DLS Card */}
            <View style={styles.halfCard}>
              <Text style={styles.cardTitle}>Net DLS</Text>
              <Text style={[styles.mainValue, styles.noWrap, netDLS >= 0 ? styles.positiveValue : styles.negativeValue]}>
                ₹{netDLS.toLocaleString('en-IN')}
              </Text>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Total DLS - Expenditure</Text>
                <Text style={styles.statValue}>
                  ₹{stats?.total_dls.toLocaleString('en-IN') || '0'} - ₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Monthly Performance Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            {/* FEEDBACK #15: All values in one aligned line, removed vertical divider */}
            <View style={styles.metricsRowAligned}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Earnings</Text>
                <Text style={[styles.metricValue, styles.noWrap]}>₹{stats?.total_earnings.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Expenditure</Text>
                <Text style={[styles.metricValue, styles.noWrap]}>₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Net Profit</Text>
                <Text style={[
                  styles.metricValue,
                  styles.noWrap,
                  (stats?.net_profit || 0) >= 0 ? styles.positiveValue : styles.negativeValue
                ]}>
                  ₹{stats?.net_profit.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dairy Lock Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dairy Lock Sales</Text>
            <View style={styles.metricsRowAligned}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Total</Text>
                <Text style={[styles.dlsValue, styles.noWrap]}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>This Month</Text>
                <Text style={[styles.dlsMonthValue, styles.noWrap]}>₹{currentMonthDLS.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Monthly Actual Profit</Text>
                <Text style={[
                  styles.dlsNetProfit,
                  styles.noWrap,
                  (currentMonthDLS - (stats?.total_expenditure || 0)) >= 0 ? styles.positiveValue : styles.negativeValue
                ]}>
                  ₹{(currentMonthDLS - (stats?.total_expenditure || 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Event Calendar */}
          <View style={styles.card}>
            <View style={styles.calendarHeader}>
              <Text style={styles.cardTitle}>Event Calendar</Text>
              {/* FEEDBACK #6: Removed '+' icon - users can click on calendar dates directly */}
            </View>

            <Calendar
              markedDates={{
                ...events.reduce((acc: any, event: any) => {
                  acc[event.date] = {
                    marked: true,
                    dotColor: event.reminder ? '#EF4444' : '#10B981', // FEEDBACK #6: Red dot for reminders
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
              // FEEDBACK #6: Track month changes
              onMonthChange={(month: any) => {
                setSelectedMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
              }}
              theme={{
                selectedDayBackgroundColor: '#10B981',
                todayTextColor: '#10B981',
                arrowColor: '#10B981',
              }}
            />

            {/* FEEDBACK #6: Event List - Filtered by selected month */}
            <View style={styles.eventList}>
              <Text style={styles.eventListTitle}>
                Events - {new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              {filteredEvents.map((event: any) => (
                <View key={event._id} style={styles.eventItem}>
                  <View style={styles.eventDot} />
                  <View style={styles.eventContent}>
                    <Text style={styles.eventDate}>{event.date}</Text>
                    <Text style={styles.eventDesc}>
                      {event.description}
                      {event.reminder && ` 🔔 (${event.reminder.replace('_', ' ')})`}
                    </Text>
                  </View>
                  {/* FEEDBACK #12: No delete confirmation for calendar events */}
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
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {filteredEvents.length === 0 && (
                <Text style={styles.noEventsText}>No events for this month</Text>
              )}
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

              {/* FEEDBACK #6: Reminder Options */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Reminder</Text>
                <View style={styles.reminderOptions}>
                  {['none', '15_days', '1_month', '3_months', '6_months', '1_year'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.reminderButton,
                        reminder === option && styles.reminderButtonActive,
                      ]}
                      onPress={() => setReminder(option)}
                    >
                      <Text style={[
                        styles.reminderButtonText,
                        reminder === option && styles.reminderButtonTextActive,
                      ]}>
                        {option === 'none' ? 'None' : option.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
  // FEEDBACK #7: Two column layout for Investment and Net DLS
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  // FEEDBACK #8: Prevent number wrapping
  noWrap: {
    flexShrink: 0,
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
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
  // FEEDBACK #15: Aligned metrics row without vertical divider
  metricsRowAligned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dlsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  dlsMonthValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
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
  eventList: {
    marginTop: 16,
  },
  eventListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
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
  noEventsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
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
    maxHeight: '70%',
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
  // FEEDBACK #6: Reminder option buttons
  reminderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  reminderButtonText: {
    fontSize: 12,
    color: '#374151',
  },
  reminderButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
