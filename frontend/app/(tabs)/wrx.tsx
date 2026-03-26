import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

export default function WRXScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-fetch when tab is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
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
    <View style={styles.container}>
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

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
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
                      { backgroundColor: `${getTypeColor(notif.type)}20` },
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
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  unreadBadge: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationUnread: { borderLeftWidth: 4, borderLeftColor: '#10B981' },
  notificationHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  messageContainer: { flex: 1 },
  message: { fontSize: 14, color: '#1F2937', lineHeight: 20, marginBottom: 4 },
  time: { fontSize: 11, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginLeft: 8, marginTop: 6 },
  reactionsContainer: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  reactionsLabel: { fontSize: 11, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  reactionButtons: { flexDirection: 'row', gap: 8 },
  reactionButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionButtonActive: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
  reactionEmoji: { fontSize: 18 },
  allReactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  reactionChip: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  reactionChipText: { fontSize: 12, color: '#059669', fontWeight: '500' },
});