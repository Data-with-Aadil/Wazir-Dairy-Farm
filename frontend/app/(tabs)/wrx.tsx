📄 Complete Code for app/(tabs)/wrx.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../context/AuthContext';

const API_URL = 'YOUR_BACKEND_URL'; // Replace with your actual backend URL

interface Event {
  id: string;
  date: string;
  description: string;
  created_by: string;
  reminder?: string;
  reminder_date?: string;
  deleted: boolean;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  data: any;
  read_by: string[];
  reactions: { [key: string]: string };
  created_at: string;
}

export default function WRXScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminder, setReminder] = useState<string>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [activeTab, setActiveTab] = useState<'events' | 'notifications'>('events');

  useEffect(() => {
    fetchEvents();
    fetchNotifications();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/events`);
      const data = await response.json();
      setEvents(data.filter((event: Event) => !event.deleted));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/api/notifications`);
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const calculateReminderDate = (eventDate: Date, reminderType: string): string | undefined => {
    if (reminderType === 'none') return undefined;
    
    const reminderDate = new Date(eventDate);
    switch (reminderType) {
      case '15_days':
        reminderDate.setDate(reminderDate.getDate() - 15);
        break;
      case '1_month':
        reminderDate.setMonth(reminderDate.getMonth() - 1);
        break;
      case '2_months':
        reminderDate.setMonth(reminderDate.getMonth() - 2);
        break;
      case '3_months':
        reminderDate.setMonth(reminderDate.getMonth() - 3);
        break;
      default:
        return undefined;
    }
    return reminderDate.toISOString().split('T')[0];
  };

  const handleSubmit = async () => {
    if (!description) {
      Alert.alert('Error', 'Please enter event description');
      return;
    }

    const eventData = {
      date: date.toISOString().split('T')[0],
      description,
      created_by: user?.name || 'Unknown',
      reminder: reminder !== 'none' ? reminder : undefined,
      reminder_date: calculateReminderDate(date, reminder),
      deleted: false,
    };

    try {
      if (editingId) {
        // Update existing event
        await fetch(`${API_URL}/api/events/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      } else {
        // Create new event
        await fetch(`${API_URL}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
      }

      setDescription('');
      setDate(new Date());
      setReminder('none');
      setEditingId(null);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event');
    }
  };

  const handleEdit = (event: Event) => {
    setDescription(event.description);
    setDate(new Date(event.date));
    setReminder(event.reminder || 'none');
    setEditingId(event.id);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/events/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleted: true }),
              });
              fetchEvents();
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: user?.name }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB');
  };

  const getReminderLabel = (reminderType?: string) => {
    switch (reminderType) {
      case '15_days':
        return '15d';
      case '1_month':
        return '1m';
      case '2_months':
        return '2m';
      case '3_months':
        return '3m';
      default:
        return null;
    }
  };

  // Filter events by selected month
  const filteredEvents = events.filter((event) => {
    const eventMonth = event.date.substring(0, 7);
    return eventMonth === selectedMonth;
  });

  // Get marked dates for calendar
  const markedDates = events.reduce((acc: any, event) => {
    if (!event.deleted) {
      acc[event.date] = { marked: true, dotColor: '#e74c3c' };
    }
    return acc;
  }, {});

  // Count unread notifications
  const unreadCount = notifications.filter(
    (notif) => !notif.read_by.includes(user?.name || '')
  ).length;

  return (
    <ImageBackground
      source={require('../../assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'events' && styles.activeTab]}
              onPress={() => setActiveTab('events')}
            >
              <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
                Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
              onPress={() => setActiveTab('notifications')}
            >
              <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
                Notifications
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </Text>
              {unreadCount > 0 && <View style={styles.redDot} />}
            </TouchableOpacity>
          </View>

          {activeTab === 'events' ? (
            <>
              {/* Calendar */}
              <View style={styles.calendarContainer}>
                <Calendar
                  markedDates={markedDates}
                  onMonthChange={(month) => {
                    setSelectedMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
                  }}
                  theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'rgba(255, 255, 255, 0.95)',
                    textSectionTitleColor: '#2c3e50',
                    selectedDayBackgroundColor: '#e74c3c',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#e74c3c',
                    dayTextColor: '#2c3e50',
                    textDisabledColor: '#d9e1e8',
                    dotColor: '#e74c3c',
                    arrowColor: '#e74c3c',
                  }}
                />
              </View>

              {/* Event Form */}
              <View style={styles.formContainer}>
                <Text style={styles.title}>
                  {editingId ? 'Edit Event' : 'Add Event'}
                </Text>

                {/* Description Input */}
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter event description"
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Date Picker */}
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {date.toLocaleDateString('en-GB')}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}

                {/* Reminder Picker */}
                <Text style={styles.label}>Reminder</Text>
                <View style={styles.reminderContainer}>
                  {['none', '15_days', '1_month', '2_months', '3_months'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.reminderOption,
                        reminder === option && styles.reminderOptionActive,
                      ]}
                      onPress={() => setReminder(option)}
                    >
                      <Text
                        style={[
                          styles.reminderOptionText,
                          reminder === option && styles.reminderOptionTextActive,
                        ]}
                      >
                        {option === 'none' ? 'None' : option.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Submit Button */}
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                  <Text style={styles.submitButtonText}>
                    {editingId ? 'Update Event' : 'Add Event'}
                  </Text>
                </TouchableOpacity>

                {editingId && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setEditingId(null);
                      setDescription('');
                      setDate(new Date());
                      setReminder('none');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Events List (Filtered by Month) */}
              <View style={styles.listContainer}>
                <Text style={styles.listTitle}>
                  Events - {new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </Text>
                <FlatList
                  data={filteredEvents}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={styles.eventCard}>
                      <View style={styles.eventInfo}>
                        <View style={styles.eventHeader}>
                          <Text style={styles.eventDescription}>{item.description}</Text>
                          {item.reminder && (
                            <View style={styles.reminderBadge}>
                              <Text style={styles.reminderBadgeText}>
                                {getReminderLabel(item.reminder)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.eventDate}>{formatDate(item.date)}</Text>
                        <Text style={styles.eventCreator}>By: {item.created_by}</Text>
                      </View>
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEdit(item)}
                        >
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDelete(item.id)}
                        >
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No events for this month</Text>
                  }
                />
              </View>
            </>
          ) : (
            // Notifications Tab
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Activity Feed</Text>
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const isRead = item.read_by.includes(user?.name || '');
                  return (
                    <TouchableOpacity
                      style={[styles.notificationCard, !isRead && styles.unreadNotification]}
                      onPress={() => !isRead && markAsRead(item.id)}
                    >
                      <View style={styles.notificationContent}>
                        {!isRead && <View style={styles.unreadDot} />}
                        <View style={styles.notificationInfo}>
                          <Text style={styles.notificationType}>{item.type}</Text>
                          <Text style={styles.notificationMessage}>{item.message}</Text>
                          <Text style={styles.notificationTime}>
                            {new Date(item.created_at).toLocaleString('en-GB')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No notifications yet</Text>
                }
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    marginBottom: 20,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#e74c3c',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  activeTabText: {
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  redDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
  },
  calendarContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
    minHeight: 60,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  reminderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  reminderOptionActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  reminderOptionText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  reminderOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  eventInfo: {
    marginBottom: 10,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  reminderBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  reminderBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDate: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
    marginBottom: 4,
  },
  eventCreator: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  actionButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  unreadNotification: {
    backgroundColor: '#ecf0f1',
    borderColor: '#e74c3c',
    borderWidth: 2,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e74c3c',
    marginRight: 10,
    marginTop: 5,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notificationMessage: {
    fontSize: 15,
    color: '#2c3e50',
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyText: {
    textAlign: 'center',
    color: '#95a5a6',
    fontSize: 16,
    marginTop: 20,
  },
});
