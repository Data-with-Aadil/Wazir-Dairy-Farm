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
  const [reminder, setReminder] = useState('none');
  const [addingEvent, setAddingEvent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
      if (!isLoading && !user) {
        router.replace('/');
      }
    }, [user, isLoading]);

  // ✅ FIX #2: State for the Month/Year filter
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const setupUsers = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/setup`, { method: 'POST' });
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  const fetchStats = async () => {
      try {
        // ✅ Add the query parameters here
        const response = await fetch(
          `${BACKEND_URL}/api/stats/dashboard?month=${selectedMonth}&year=${selectedYear}`
        );
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
  
    // ✅ Add this so it refreshes whenever you change the month/year
    useFocusEffect(
      React.useCallback(() => {
        // Screen focus par scroll top karein
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        
        // Saara data fetch karein
        fetchStats();
        fetchChartData();
        fetchDLS();
        fetchEvents();
      }, [selectedMonth, selectedYear]) // In dono ke change hote hi data refresh hoga
    );

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
          reminder: reminder !== 'none' ? reminder : undefined,
          reminder_date: calculateReminderDate(selectedDate, reminder),
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
    try {
      await Promise.all([
        fetchStats(),
        fetchChartData(),
        fetchDLS(),
        fetchEvents()
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  // FEEDBACK #7: Fixed logout with router.replace
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
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #10B981; }
    h2 { color: #374151; margin-top: 20px; }
    p { color: #6B7280; }
  </style>
</head>
<body>
  <h1>🐄 Wazir Dairy Farming - Report (${selectedMonth}/${selectedYear})</h1>
  <p>Generated on ${new Date().toLocaleDateString()}</p>
  
  <h2>Total Investment</h2>
  <p><strong>Total:</strong> ₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Aadil:</strong> ₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Imran:</strong> ₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</p>
  
  <h2>Monthly Performance</h2>
  <p><strong>Earnings:</strong> ₹${stats?.total_earnings.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Expenditure:</strong> ₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Net Profit:</strong> ₹${stats?.net_profit.toLocaleString('en-IN') || '0'}</p>
  
  <h2>Dairy Lock Sales</h2>
  <p><strong>Total:</strong> ₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Current Month:</strong> ₹${currentMonthDLS.toLocaleString('en-IN')}</p>
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

  const filteredEvents = events.filter((event: any) => {
    const eventMonth = event.date.substring(0, 7);
    return eventMonth === selectedMonth;
  });

  // FEEDBACK #2: Calculate Net DLS
  const netDLS = (stats?.total_dls || 0) - (stats?.total_expenditure || 0);

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      fetchStats();
      fetchChartData();
      fetchDLS();
      fetchEvents();
    }, [])
  );

  useEffect(() => {
      if (!isLoading && !user) {
        router.replace('/');
      }
    }, [user, isLoading]);

  // ✅ FIX #2: State for the Month/Year filter
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const setupUsers = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/setup`, { method: 'POST' });
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  const fetchStats = async () => {
      try {
        // ✅ Add the query parameters here
        const response = await fetch(
          `${BACKEND_URL}/api/stats/dashboard?month=${selectedMonth}&year=${selectedYear}`
        );
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
  
    // ✅ Add this so it refreshes whenever you change the month/year
    useFocusEffect(
      React.useCallback(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
        fetchStats(); // Ye ab automatic selectedMonth/Year le lega
        fetchChartData();
        fetchDLS();
        fetchEvents();
      }, [selectedMonth, selectedYear]) // In dono dependencies ko yahan zaroor likhna
    );

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
          reminder: reminder !== 'none' ? reminder : undefined,
          reminder_date: calculateReminderDate(selectedDate, reminder),
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
    try {
      await Promise.all([
        fetchStats(),
        fetchChartData(),
        fetchDLS(),
        fetchEvents()
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  // FEEDBACK #7: Fixed logout with router.replace
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
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #10B981; }
    h2 { color: #374151; margin-top: 20px; }
    p { color: #6B7280; }
  </style>
</head>
<body>
  <h1>🐄 Wazir Dairy Farming - Report (${selectedMonth}/${selectedYear})</h1>
  <p>Generated on ${new Date().toLocaleDateString()}</p>
  
  <h2>Total Investment</h2>
  <p><strong>Total:</strong> ₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Aadil:</strong> ₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Imran:</strong> ₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</p>
  
  <h2>Monthly Performance</h2>
  <p><strong>Earnings:</strong> ₹${stats?.total_earnings.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Expenditure:</strong> ₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Net Profit:</strong> ₹${stats?.net_profit.toLocaleString('en-IN') || '0'}</p>
  
  <h2>Dairy Lock Sales</h2>
  <p><strong>Total:</strong> ₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</p>
  <p><strong>Current Month:</strong> ₹${currentMonthDLS.toLocaleString('en-IN')}</p>
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

  const filteredEvents = events.filter((event: any) => {
    const eventMonth = event.date.substring(0, 7);
    return eventMonth === selectedMonth;
  });

  // FEEDBACK #2: Calculate Net DLS
  const netDLS = (stats?.total_dls || 0) - (stats?.total_expenditure || 0);

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.filterCard}>
             <Text style={styles.filterLabel}>Performance Period:</Text>
             <View style={styles.pickerRow}>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={(val) => setSelectedMonth(val)}
                    style={styles.picker}
                  >
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                      .map((m, i) => <Picker.Item key={m} label={m} value={i + 1} />)}
                  </Picker>
                </View>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={(val) => setSelectedYear(val)}
                    style={styles.picker}
                  >
                    {[2024, 2025, 2026].map(y => <Picker.Item key={y} label={y.toString()} value={y} />)}
                  </Picker>
                </View>
             </View>
          </View>
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={exportToPDF} style={styles.exportButton} disabled={exporting}>
                <Ionicons name="download-outline" size={24} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* FEEDBACK #2: Investment and Net DLS Side by Side */}
          <View style={styles.twoColumnRow}>
            {/* Total Investment Card */}
            <View style={styles.halfCard}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Total Investment
              </Text>
              <Text style={[styles.mainValue, styles.noWrap]} numberOfLines={1}>
                ₹{stats?.total_investment.toLocaleString('en-IN') || '0'}
              </Text>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  Aadil
                </Text>
                <Text style={[styles.summaryValue, styles.noWrap]} numberOfLines={1}>
                  ₹{stats?.aadil_investment.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  Imran
                </Text>
                <Text style={[styles.summaryValue, styles.noWrap]} numberOfLines={1}>
                  ₹{stats?.imran_investment.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>

            {/* Net DLS Card - FEEDBACK #2: No calculation text visible */}
            <View style={styles.halfCard}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Net DLS
              </Text>
              <Text
                style={[
                  styles.mainValue,
                  styles.noWrap,
                  netDLS >= 0 ? styles.positiveValue : styles.negativeValue,
                ]}
                numberOfLines={1}
              >
                ₹{netDLS.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.netDLSSubtext} numberOfLines={1}>
                DLS - Expenditure
              </Text>
            </View>
          </View>

          {/* Monthly Performance Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            <View style={styles.metricsRowAligned}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  Earnings
                </Text>
                <Text style={[styles.metricValue, styles.noWrap]} numberOfLines={1}>
                  ₹{stats?.total_earnings.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  Expenditure
                </Text>
                <Text style={[styles.metricValue, styles.noWrap]} numberOfLines={1}>
                  ₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  Net Profit
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    styles.noWrap,
                    (stats?.net_profit || 0) >= 0 ? styles.positiveValue : styles.negativeValue,
                  ]}
                  numberOfLines={1}
                >
                  ₹{stats?.net_profit.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dairy Lock Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dairy Lock Sales</Text>
            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  Total
                </Text>
                <Text style={[styles.dlsValue, styles.noWrap]} numberOfLines={1}>
                  ₹{stats?.total_dls.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  This Month
                </Text>
                <Text style={[styles.dlsMonthValue, styles.noWrap]} numberOfLines={1}>
                  ₹{currentMonthDLS.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  Monthly Profit
                </Text>
                <Text
                  style={[
                    styles.dlsNetProfit,
                    styles.noWrap,
                    currentMonthDLS - (stats?.total_expenditure || 0) >= 0
                      ? styles.positiveValue
                      : styles.negativeValue,
                  ]}
                  numberOfLines={1}
                >
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
                  if (!event.deleted) {
                    acc[event.date] = {
                      marked: true,
                      dotColor: event.reminder ? '#EF4444' : '#10B981',
                      customStyles: {
                        container: {
                          backgroundColor: '#F0FDF4',
                        },
                      },
                    };
                  }
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
              onMonthChange={(month: any) => {
                setSelectedMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
              }}
              theme={{
                selectedDayBackgroundColor: '#10B981',
                todayTextColor: '#10B981',
                arrowColor: '#10B981',
              }}
            />

            <View style={styles.eventList}>
              <Text style={styles.eventListTitle} numberOfLines={1}>
                Events - {new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              {filteredEvents.map((event: any) => (
                <View key={event._id} style={styles.eventItem}>
                  <View style={styles.eventDot} />
                  <View style={styles.eventContent}>
                    <Text style={styles.eventDate} numberOfLines={1}>
                      {event.date}
                    </Text>
                    <Text style={styles.eventDesc} numberOfLines={1}>
                      {event.description}
                      {event.reminder && ` 🔔 (${event.reminder.replace('_', ' ')})`}
                    </Text>
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
        <Modal visible={eventModalVisible} transparent animationType="slide">
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
                      <Text
                        style={[
                          styles.reminderButtonText,
                          reminder === option && styles.reminderButtonTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {option === 'none' ? 'None' : option.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {addingEvent ? (
                <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} />
              ) : (
                <TouchableOpacity onPress={handleAddEvent} style={styles.submitButton}>
                  <Text style={styles.submitButtonText}>Add Event</Text>
                </TouchableOpacity>
              )}
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
    fontSize: 13, // FEEDBACK #3
    color: '#6B7280',
  },
  userName: {
    fontSize: 22, // FEEDBACK #3: Reduced from 24
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
  // FEEDBACK #2: Two column layout
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16, // FEEDBACK #3: Reduced
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16, // FEEDBACK #3: Reduced
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14, // FEEDBACK #3
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  mainValue: {
    fontSize: 22, // FEEDBACK #3: Reduced
    fontWeight: '700',
    color: '#10B981',
  },
  // FEEDBACK #3: Prevent number wrapping
  noWrap: {
    flexShrink: 0,
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  netDLSSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11, // FEEDBACK #3
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15, // FEEDBACK #3
    fontWeight: '600',
    color: '#111827',
  },
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
    fontSize: 15, // FEEDBACK #3
    fontWeight: '600',
    color: '#1F2937',
  },
  dlsValue: {
    fontSize: 16, // FEEDBACK #3
    fontWeight: '600',
    color: '#10B981',
  },
  dlsMonthValue: {
    fontSize: 16, // FEEDBACK #3
    fontWeight: '600',
    color: '#3B82F6',
  },
  dlsNetProfit: {
    fontSize: 16, // FEEDBACK #3
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
    fontSize: 13, // FEEDBACK #3
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
    fontSize: 11, // FEEDBACK #3
    color: '#6B7280',
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13, // FEEDBACK #3
    color: '#1F2937',
    fontWeight: '500',
  },
  noEventsText: {
    fontSize: 13,
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
    fontSize: 18, // FEEDBACK #3
    fontWeight: 'bold',
    color: '#1F2937',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13, // FEEDBACK #3
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
    fontSize: 15, // FEEDBACK #3
    color: '#1F2937',
  },
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
    fontSize: 11, // FEEDBACK #3
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
    fontSize: 15, // FEEDBACK #3
    fontWeight: '600',
  },
});
