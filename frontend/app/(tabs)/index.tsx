import React, { useEffect, useState, useMemo } from 'react';
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
  Platform,
  KeyboardAvoidingView,
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
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentYearForArray = new Date().getFullYear();
// यह 2024 से लेकर (Current Year + 2) तक का डायनामिक ऐरे बनाएगा
const YEARS = Array.from({ length: (currentYearForArray + 2) - 2024 + 1 }, (_, i) => 2024 + i);

// ✅ Bulletproof Date Parser (Fixes timezone 0 data bugs)
const parseDateString = (dateStr: string) => {
  if (!dateStr) return { month: 0, year: 0 };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }
  return { month: 0, year: 0 };
};

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

interface Investment {
  date: string;
  amount: number;
  investor: string;
}

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user, logout, isLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  
  // Local Data States
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [milkSales, setMilkSales] = useState<MilkSale[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Modals & UI States
  const [exporting, setExporting] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [reminder, setReminder] = useState('none');
  const [addingEvent, setAddingEvent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Internal Filters States
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [perfMonth, setPerfMonth] = useState(currentMonth);
  const [perfYear, setPerfYear] = useState(currentYear);
  
  const [dlsFilterMonth, setDlsFilterMonth] = useState(0); // 0 = All Time
  const [dlsFilterYear, setDlsFilterYear] = useState(currentYear);
  
  const [calMonth, setCalMonth] = useState(currentMonth);
  const [calYear, setCalYear] = useState(currentYear);

  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading]);

  useFocusEffect(
    React.useCallback(() => {
      fetchAllData();
    }, [])
  );

  const fetchAllData = async () => {
    try {
      const [invRes, salesRes, expRes, dlsRes, eventsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/investments`),
        fetch(`${BACKEND_URL}/api/milk-sales`),
        fetch(`${BACKEND_URL}/api/expenditures`),
        fetch(`${BACKEND_URL}/api/dairy-lock-sales`),
        fetch(`${BACKEND_URL}/api/events`)
      ]);

      if (invRes.ok) setInvestments(await invRes.json());
      if (salesRes.ok) setMilkSales(await salesRes.json());
      if (expRes.ok) setExpenditures(await expRes.json());
      if (dlsRes.ok) setDlsList(await dlsRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
  };

  // 1. ALL TIME STATS
  const allTimeStats = useMemo(() => {
    const totalInv = investments.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const aadilInv = investments.filter(i => i.investor === 'Aadil').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const imranInv = investments.filter(i => i.investor === 'Imran').reduce((sum, i) => sum + Number(i.amount || 0), 0);
    
    const totalDlsAll = dlsList.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalExpAll = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netDlsAllTime = totalDlsAll - totalExpAll;

    return { totalInv, aadilInv, imranInv, netDlsAllTime, totalDlsAll, totalExpAll };
  }, [investments, dlsList, expenditures]);

  // 2. MONTHLY PERFORMANCE STATS (Uses safe parseDateString)
  const perfStats = useMemo(() => {
    const earnings = milkSales.filter(s => {
      const d = parseDateString(s.date);
      if (perfMonth === 0) return d.year === perfYear;
      return d.month === perfMonth && d.year === perfYear;
    }).reduce((sum, s) => sum + Number(s.earnings || 0), 0);

    const exp = expenditures.filter(e => {
      const d = parseDateString(e.date);
      if (perfMonth === 0) return d.year === perfYear;
      return d.month === perfMonth && d.year === perfYear;
    }).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return { earnings, exp, net: earnings - exp };
  }, [milkSales, expenditures, perfMonth, perfYear]);

  // 3. DAIRY LOCK SALES STATS
  const dlsStats = useMemo(() => {
    if (dlsFilterMonth === 0) {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const totalDlsTillLastMonth = dlsList.filter(d => 
        d.year < lastMonthYear || (d.year === lastMonthYear && d.month <= lastMonth)
      ).reduce((sum, d) => sum + Number(d.amount || 0), 0);

      const lastMonthDls = dlsList.filter(d => d.month === lastMonth && d.year === lastMonthYear).reduce((sum, d) => sum + Number(d.amount || 0), 0);
      
      const lastMonthExp = expenditures.filter(e => {
        const d = parseDateString(e.date);
        return d.month === lastMonth && d.year === lastMonthYear;
      }).reduce((sum, e) => sum + Number(e.amount || 0), 0);

      return {
        label1: 'Total (Till Last Month)', val1: totalDlsTillLastMonth,
        label2: 'Last Month DLS', val2: lastMonthDls,
        label3: 'Last Month Profit', val3: lastMonthDls - lastMonthExp
      };
    } else {
      const currentMonthDls = dlsList.filter(d => d.month === dlsFilterMonth && d.year === dlsFilterYear).reduce((sum, d) => sum + Number(d.amount || 0), 0);
      
      const currentMonthExp = expenditures.filter(e => {
        const d = parseDateString(e.date);
        return d.month === dlsFilterMonth && d.year === dlsFilterYear;
      }).reduce((sum, e) => sum + Number(e.amount || 0), 0);

      return {
        label1: `Total DLS in ${MONTHS[dlsFilterMonth-1]}`, val1: currentMonthDls,
        label2: `${MONTHS[dlsFilterMonth-1]} DLS`, val2: currentMonthDls,
        label3: `${MONTHS[dlsFilterMonth-1]} Profit`, val3: currentMonthDls - currentMonthExp
      };
    }
  }, [dlsList, expenditures, dlsFilterMonth, dlsFilterYear, currentMonth, currentYear]);

  const calculateReminderDate = (eventDate: string, reminderType: string): string | undefined => {
    if (reminderType === 'none') return undefined;
    const date = new Date(eventDate);
    switch (reminderType) {
      case '15_days': date.setDate(date.getDate() - 15); break;
      case '1_month': date.setMonth(date.getMonth() - 1); break;
      case '3_months': date.setMonth(date.getMonth() - 3); break;
      case '6_months': date.setMonth(date.getMonth() - 6); break;
      case '1_year': date.setFullYear(date.getFullYear() - 1); break;
      default: return undefined;
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
        fetchAllData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add event');
    } finally {
      setAddingEvent(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
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
  <h1>🐄 Wazir Dairy Farming - Report</h1>
  <p>Generated on ${new Date().toLocaleDateString()}</p>
  
  <h2>Overall Stats (All Time)</h2>
  <p><strong>Total Investment:</strong> ₹${allTimeStats.totalInv.toLocaleString('en-IN')}</p>
  <p><strong>Total Net DLS:</strong> ₹${allTimeStats.netDlsAllTime.toLocaleString('en-IN')}</p>
  
  <h2>Selected Performance (${perfMonth === 0 ? 'All Year' : MONTHS[perfMonth-1]} ${perfYear})</h2>
  <p><strong>Earnings:</strong> ₹${perfStats.earnings.toLocaleString('en-IN')}</p>
  <p><strong>Expenditure:</strong> ₹${perfStats.exp.toLocaleString('en-IN')}</p>
  <p><strong>Net Profit:</strong> ₹${perfStats.net.toLocaleString('en-IN')}</p>
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
    const formattedSelectedMonthYear = `${calYear}-${String(calMonth).padStart(2, '0')}`;
    return eventMonth === formattedSelectedMonthYear;
  });

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
              <Text style={styles.userName} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
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

          {/* ✅ Point 3 Fix: Imran Inv & Aadil Inv placed on the left side */}
          <View style={styles.card}>
            <Text style={styles.cardTitleMerged}>Overall Dashboard (All Time)</Text>
            <View style={styles.twoColumnRow}>
              <View style={styles.halfColLeft}>
                <Text style={styles.statLabelMerged}>Total Investment</Text>
                <Text style={styles.mainValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
                  ₹{allTimeStats.totalInv.toLocaleString('en-IN')}
                </Text>
                
                <View style={styles.subStatsContainer}>
                  <Text style={styles.subStatText}>Aadil: ₹{allTimeStats.aadilInv.toLocaleString('en-IN')}</Text>
                  <Text style={styles.subStatText}>Imran: ₹{allTimeStats.imranInv.toLocaleString('en-IN')}</Text>
                </View>
              </View>
              
              <View style={styles.verticalDivider} />
              
              <View style={styles.halfColRight}>
                <Text style={styles.statLabelMerged}>Total DLS (Net)</Text>
                <Text
                  style={[styles.mainValue, allTimeStats.netDlsAllTime >= 0 ? styles.positiveValue : styles.negativeValue]}
                  adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}
                >
                  ₹{allTimeStats.netDlsAllTime.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.netDLSSubtext} numberOfLines={1}>Total DLS - Total Exp</Text>
              </View>
            </View>
          </View>

          {/* MONTHLY PERFORMANCE CARD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            <View style={styles.pickerRowInner}>
              <View style={styles.pickerWrapperInner}>
                <Picker 
                  selectedValue={perfMonth} 
                  onValueChange={(val) => setPerfMonth(Number(val))} 
                  style={styles.picker} 
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="All Year" value={0} color="#374151" />
                  {MONTHS.map((m, i) => <Picker.Item key={m} label={m} value={i + 1} color="#374151" />)}
                </Picker>
              </View>
              <View style={styles.pickerWrapperInner}>
                <Picker 
                  selectedValue={perfYear} 
                  onValueChange={(val) => setPerfYear(Number(val))} 
                  style={styles.picker} 
                  itemStyle={styles.pickerItem}
                >
                  {YEARS.map(y => <Picker.Item key={y} label={y.toString()} value={y} color="#374151" />)}
                </Picker>
              </View>
            </View>

            <View style={styles.metricsRowAligned}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>Earnings</Text>
                <Text style={styles.metricValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
                  ₹{perfStats.earnings.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>Expenditure</Text>
                <Text style={styles.metricValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
                  ₹{perfStats.exp.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel} numberOfLines={1}>Net Profit</Text>
                <Text
                  style={[styles.metricValue, perfStats.net >= 0 ? styles.positiveValue : styles.negativeValue]}
                  adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}
                >
                  ₹{perfStats.net.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* DAIRY LOCK SALES CARD */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dairy Lock Sales</Text>
            <View style={styles.pickerRowInner}>
              <View style={styles.pickerWrapperInner}>
                <Picker 
                  selectedValue={dlsFilterMonth} 
                  onValueChange={(val) => setDlsFilterMonth(Number(val))} 
                  style={styles.picker} 
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="No Filter" value={0} color="#374151" />
                  {MONTHS.map((m, i) => <Picker.Item key={m} label={m} value={i + 1} color="#374151" />)}
                </Picker>
              </View>
              <View style={styles.pickerWrapperInner}>
                <Picker 
                  selectedValue={dlsFilterYear} 
                  onValueChange={(val) => setDlsFilterYear(Number(val))} 
                  style={styles.picker} 
                  itemStyle={styles.pickerItem}
                >
                  {YEARS.map(y => <Picker.Item key={y} label={y.toString()} value={y} color="#374151" />)}
                </Picker>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>{dlsStats.label1}</Text>
                <Text style={styles.dlsValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
                  ₹{dlsStats.val1.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>{dlsStats.label2}</Text>
                <Text style={styles.dlsMonthValue} adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
                  ₹{dlsStats.val2.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>{dlsStats.label3}</Text>
                <Text
                  style={[styles.dlsNetProfit, dlsStats.val3 >= 0 ? styles.positiveValue : styles.negativeValue]}
                  adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}
                >
                  ₹{dlsStats.val3.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Event Calendar Card */}
          <View style={styles.card}>
            <View style={styles.calendarHeader}>
              <Text style={styles.cardTitle}>Event Calendar</Text>
            </View>
            <Calendar
              markedDates={{
                ...events.reduce((acc: any, event: any) => {
                  if (!event.deleted) {
                    const isReminder = !!event.reminder;
                    const existing = acc[event.date];
                    const shouldBeRed = isReminder || (existing && existing.dotColor === '#EF4444');
                    
                    acc[event.date] = {
                      marked: true,
                      dotColor: shouldBeRed ? '#EF4444' : '#10B981',
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
                setCalMonth(month.month);
                setCalYear(month.year);
              }}
              theme={{
                selectedDayBackgroundColor: '#10B981',
                todayTextColor: '#10B981',
                arrowColor: '#10B981',
              }}
            />

            <View style={styles.eventList}>
              <Text style={styles.eventListTitle} numberOfLines={1}>
                Events - {new Date(calYear, calMonth - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
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
                        fetchAllData();
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

        <Modal visible={eventModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
              style={styles.eventModalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Event</Text>
                <TouchableOpacity onPress={() => setEventModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
              >
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
                    placeholderTextColor="#9CA3AF"
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
              </ScrollView>
            </KeyboardAvoidingView>
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
    fontSize: 13,
    color: '#6B7280',
  },
  userName: {
    fontSize: 22,
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
    padding: 16,
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
    color: '#374151',
    marginBottom: 10,
  },
  cardTitleMerged: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  twoColumnRow: {
    flexDirection: 'row',
  },
  halfColLeft: {
    flex: 1,
    paddingRight: 10,
    justifyContent: 'center',
  },
  halfColRight: {
    flex: 1,
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  subStatsContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subStatText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabelMerged: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  mainValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
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
    marginTop: 2,
  },
  pickerRowInner: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  pickerWrapperInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#374151', 
  },
  pickerItem: {
    color: '#374151',
    fontSize: 14,
  },
  metricsRowAligned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  dlsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  dlsMonthValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  dlsNetProfit: {
    fontSize: 16,
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
    fontSize: 13,
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
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  eventDesc: {
    fontSize: 13,
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: { 
    backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, 
    borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, 
    fontSize: 16, color: '#374151',
    minHeight: 50, /* ✅ Added minHeight */
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
    fontSize: 11,
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
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
