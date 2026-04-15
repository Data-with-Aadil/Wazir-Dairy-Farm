import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ImageBackground, // FEEDBACK #9: Added import
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from 'react-native-calendars';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';

// FEEDBACK #9: Added background image
const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

const QUICK_REACTIONS = [
  { emoji: '👍', label: 'Okay' },
  { emoji: '✅', label: 'Good' },
  { emoji: '❌', label: 'Bad' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😊', label: 'Smile' },
];

interface Notification {
  _id: string;
  type: string;
  data: any;
  message: string;
  read_by: string[];
  reactions: { [key: string]: string };
  created_at: string;
}

interface Event {
  _id: string;
  date: string;
  description: string;
  created_by: string;
  reminder?: string;
  reminder_date?: string;
  deleted: boolean;
}

export default function WRXScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'notifications' | 'events'>('notifications');
  const scrollViewRef = useRef<ScrollView>(null);

  // Event form state
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminder, setReminder] = useState<string>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));

  // Auto-fetch when tab is focused and scroll to bottom
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
      fetchEvents();
      // Scroll to bottom after data loads
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 300);
    }, [])
  );

  useEffect(() => {
    fetchNotifications();
    fetchEvents();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchEvents();
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unread = notifications.filter(
      (notif) => !notif.read_by.includes(user?.name || '')
    ).length;
    setUnreadCount(unread);
  }, [notifications, user]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications`);
      if (response.ok) {
        const data = await response.json();
        // Reverse array so latest is at bottom
        setNotifications(data.reverse());

        // Auto-scroll to bottom after data loads
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

        // Auto-mark as read
        const unreadIds = data
          .filter((n: Notification) => !n.read_by.includes(user?.name || ''))
          .map((n: Notification) => n._id);

        if (unreadIds.length > 0) {
          markAsRead(unreadIds);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.filter((event: Event) => !event.deleted));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_ids: notificationIds,
          user: user?.name,
        }),
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleReaction = async (notificationId: string, emoji: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_id: notificationId,
          user: user?.name,
          emoji,
        }),
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add reaction');
    }
  };

  const calculateReminderDate = (eventDate: Date, reminderType: string): string | undefined => {
    if (reminderType === 'none') return undefined;
  
    const reminderDate = new Date(eventDate);
    switch (reminderType) {
      case '15_days':
        reminderDate.setDate(reminderDate.getDate() + 15);  // ✅ ADD 15 days
        break;
      case '1_month':
        reminderDate.setMonth(reminderDate.getMonth() + 1);  // ✅ ADD 1 month
        break;
      case '3_months':
        reminderDate.setMonth(reminderDate.getMonth() + 3);  // ✅ ADD 3 months
        break;
      case '6_months':
        reminderDate.setMonth(reminderDate.getMonth() + 6);  // ✅ ADD 6 months
        break;
      case '1_year':
        reminderDate.setFullYear(reminderDate.getFullYear() + 1);  // ✅ ADD 1 year
        break;
      default:
        return undefined;
    }
    return reminderDate.toISOString().split('T')[0];
  };

  const handleSubmitEvent = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter event description');
      return;
    }

    const eventData = {
      date: `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`,
      description: description.trim(),
      created_by: user?.name || 'Unknown',
      reminder: reminder !== 'none' ? reminder : undefined,
      reminder_date: calculateReminderDate(eventDate, reminder),
      deleted: false,
    };

    try {
      if (editingId) {
        // Update existing event
        const response = await fetch(`${BACKEND_URL}/api/events/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
        if (response.ok) {
          Alert.alert('Success', 'Event updated successfully');
        }
      } else {
        // Create new event
        const response = await fetch(`${BACKEND_URL}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });
        if (response.ok) {
          Alert.alert('Success', 'Event created successfully');
        }
      }

      // Reset form
      setDescription('');
      setEventDate(new Date());
      setReminder('none');
      setEditingId(null);
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      Alert.alert('Error', 'Failed to save event');
    }
  };

  const handleEditEvent = (event: Event) => {
    setDescription(event.description);
    setEventDate(new Date(event.date));
    setReminder(event.reminder || 'none');
    setEditingId(event._id);
  };

  const handleDeleteEvent = (id: string) => {
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
              const response = await fetch(`${BACKEND_URL}/api/events/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleted: true }),
              });
              if (response.ok) {
                fetchEvents();
              }
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEventDate(selectedDate);
    }
  };

  const getReminderLabel = (reminderType?: string) => {
    switch (reminderType) {
      case '15_days':
        return '15d';
      case '1_month':
        return '1m';
      case '3_months':
        return '3m';
      case '6_months':  // ADD THIS
        return '6m';
      case '1_year':  // ADD THIS
        return '1y';
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
      const isReminder = !!event.reminder;
      const existing = acc[event.date];
      // Prioritize red dot if ANY event on this day is a reminder
      const shouldBeRed = isReminder || (existing && existing.dotColor === '#EF4444');
      
      acc[event.date] = { 
        marked: true, 
        dotColor: shouldBeRed ? '#EF4444' : '#10B981'
      };
    }
    return acc;
  }, {});

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    await fetchEvents();
    setRefreshing(false);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor(diffInHours * 60);
        return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
      } else if (diffInHours < 24) {
        return format(date, 'h:mm a');
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch {
      return '';
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'investment': return 'trending-up';
      case 'expenditure': return 'cash';
      case 'milk_sale': return 'water';
      case 'dls': return 'lock-closed';
      case 'deletion': return 'trash';
      default: return 'information-circle';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'investment': return '#3B82F6';
      case 'expenditure': return '#EF4444';
      case 'milk_sale': return '#10B981';
      case 'dls': return '#8B5CF6';
      case 'deletion': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>WRX</Text>
              <Text style={styles.subtitle}>Activity Feed</Text>
            </View>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount} new</Text>
              </View>
            )}
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
              onPress={() => setActiveTab('notifications')}
            >
              <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
                Notifications
              </Text>
              {unreadCount > 0 && activeTab !== 'notifications' && (
                <View style={styles.redDot} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'events' && styles.activeTab]}
              onPress={() => setActiveTab('events')}
            >
              <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
                Events
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'notifications' ? (
            /* Notifications List */
            <ScrollView
              ref={scrollViewRef}
              style={styles.content}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No activity yet</Text>
                  <Text style={styles.emptySubtext}>All updates will appear here</Text>
                </View>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !notif.read_by.includes(user?.name || '');
                  const myReaction = notif.reactions?.[user?.name || ''];

                  return (
                    <View
                      key={notif._id}
                      style={[
                        styles.notificationCard,
                        isUnread && styles.notificationUnread,
                      ]}
                    >
                      <View style={styles.notificationHeader}>
                        <View
                          style={[
                            styles.iconCircle,
                            { backgroundColor: getTypeColor(notif.type) + '20' },
                          ]}
                        >
                          <Ionicons
                            name={getTypeIcon(notif.type) as any}
                            size={20}
                            color={getTypeColor(notif.type)}
                          />
                        </View>
                        <View style={styles.messageContainer}>
                          <Text style={styles.message}>{notif.message}</Text>
                          <Text style={styles.time}>{formatTime(notif.created_at)}</Text>
                        </View>
                        {isUnread && <View style={styles.unreadDot} />}
                      </View>

                      {/* Quick Reactions */}
                      <View style={styles.reactionsContainer}>
                        <Text style={styles.reactionsLabel}>Quick Reply:</Text>
                        <View style={styles.reactionButtons}>
                          {QUICK_REACTIONS.map((reaction) => (
                            <TouchableOpacity
                              key={reaction.label}
                              style={[
                                styles.reactionButton,
                                myReaction === reaction.emoji && styles.reactionButtonActive,
                              ]}
                              onPress={() => handleReaction(notif._id, reaction.emoji)}
                            >
                              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* All Reactions Display */}
                      {Object.keys(notif.reactions || {}).length > 0 && (
                        <View style={styles.allReactions}>
                          {Object.entries(notif.reactions || {}).map(([userName, emoji]) => (
                            <View key={userName} style={styles.reactionChip}>
                              <Text style={styles.reactionChipText}>
                                {emoji} {userName}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          ) : (
            /* Events Tab */
            <ScrollView
              style={styles.content}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
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
                    textSectionTitleColor: '#1F2937',
                    selectedDayBackgroundColor: '#10B981',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#10B981',
                    dayTextColor: '#1F2937',
                    textDisabledColor: '#D1D5DB',
                    dotColor: '#10B981',
                    arrowColor: '#10B981',
                  }}
                />
              </View>

              {/* Event Form */}
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>
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
                    {eventDate.toLocaleDateString('en-GB')}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={eventDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}

                {/* Reminder Picker */}
                <Text style={styles.label}>Reminder</Text>
                <View style={styles.reminderContainer}>
                  {['none', '15_days', '1_month', '3_months', '6_months', '1_year'].map((option) => (
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
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmitEvent}>
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
                      setEventDate(new Date());
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
                {filteredEvents.length === 0 ? (
                  <Text style={styles.emptyText}>No events for this month</Text>
                ) : (
                  filteredEvents.map((event) => (
                    <View key={event._id} style={styles.eventCard}>
                      <View style={styles.eventInfo}>
                        <View style={styles.eventHeader}>
                          <Text style={styles.eventDescription}>{event.description}</Text>
                          {event.reminder && (
                            <View style={styles.reminderBadge}>
                              <Text style={styles.reminderBadgeText}>
                                {getReminderLabel(event.reminder)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.eventDate}>{formatDate(event.date)}</Text>
                        <Text style={styles.eventCreator}>By: {event.created_by}</Text>
                      </View>
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEditEvent(event)}
                        >
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDeleteEvent(event._id)}
                        >
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
  // FEEDBACK #9: Added overlay style
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#fff',
  },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  notificationCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 8,
    marginTop: 6,
  },
  reactionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  reactionsLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  reactionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  reactionButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionButtonActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  reactionEmoji: {
    fontSize: 18,
  },
  allReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  reactionChip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reactionChipText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  calendarContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 60,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#1F2937',
  },
  reminderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reminderOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  reminderOptionActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  reminderOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  reminderOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventInfo: {
    marginBottom: 10,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  eventDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  reminderBadge: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  reminderBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  eventDate: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
  eventCreator: {
    fontSize: 11,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  actionButtonText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
});
