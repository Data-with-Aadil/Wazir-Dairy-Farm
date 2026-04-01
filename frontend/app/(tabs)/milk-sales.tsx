import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm.onrender.com";

interface MilkSale {
  _id: string;
  date: string;
  volume: number;
  fat_percentage: number;
  rate: number;
  earnings: number;
  deleted: boolean;
}

export default function MilkSalesScreen() {
  const { user } = useAuth();
  const [sales, setSales] = useState<MilkSale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [volume, setVolume] = useState('');
  const [fatPercentage, setFatPercentage] = useState('');
  const [rate, setRate] = useState('8.4');

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/milk-sales`);
      if (response.ok) {
        const data = await response.json();
        setSales(data.slice(0, 20));
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSales();
    setRefreshing(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleAddSale = async () => {
    if (!volume || !fatPercentage || !rate) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const vol = parseFloat(volume);
    const fat = parseFloat(fatPercentage);
    const r = parseFloat(rate);

    if (isNaN(vol) || isNaN(fat) || isNaN(r)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }

    const earnings = r * fat * vol;

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/milk-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString().split('T')[0],
          volume: vol,
          fat_percentage: fat,
          rate: r,
          earnings,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Milk sale added successfully');
        setModalVisible(false);
        resetForm();
        fetchSales();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add milk sale');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sale: MilkSale) => {
    setEditMode(true);
    setEditingId(sale._id);
    setDate(new Date(sale.date));
    setVolume(sale.volume.toString());
    setFatPercentage(sale.fat_percentage.toString());
    setRate(sale.rate.toString());
    setModalVisible(true);
  };

  const handleUpdateSale = async () => {
    if (!volume || !fatPercentage || !rate || !editingId) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const vol = parseFloat(volume);
    const fat = parseFloat(fatPercentage);
    const r = parseFloat(rate);

    if (isNaN(vol) || isNaN(fat) || isNaN(r)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }

    const earnings = r * fat * vol;

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/milk-sales/${editingId}?user=${user?.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString().split('T')[0],
          volume: vol,
          fat_percentage: fat,
          rate: r,
          earnings,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Milk sale updated successfully');
        setModalVisible(false);
        setEditMode(false);
        setEditingId(null);
        resetForm();
        fetchSales();
      } else {
        Alert.alert('Error', 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update milk sale');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/milk-sales/${id}?user=${user?.name}`, {
              method: 'DELETE',
            });
            if (response.ok) {
              fetchSales();
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete entry');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setDate(new Date());
    setVolume('');
    setFatPercentage('');
    setRate('8.4');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const calculateEarnings = () => {
    const vol = parseFloat(volume) || 0;
    const fat = parseFloat(fatPercentage) || 0;
    const r = parseFloat(rate) || 0;
    return (r * fat * vol).toFixed(2);
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>Milk Sales</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Sales List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {sales.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="water-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No milk sales yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
              </View>
            ) : (
              sales.map((sale) => (
                <View key={sale._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardDate} numberOfLines={1}>{sale.date}</Text>
                      <Text style={[styles.cardAmount, styles.noWrap]} numberOfLines={1}>
                        ₹{sale.earnings.toLocaleString('en-IN')}
                      </Text>
                    </View>
                    {/* FEEDBACK #1: Transparent buttons with border */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => handleEdit(sale)} style={styles.editIconButton}>
                        <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(sale._id)} style={styles.deleteIconButton}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.cardDetails}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel} numberOfLines={1}>Volume</Text>
                      <Text style={[styles.detailValue, styles.noWrap]} numberOfLines={1}>{sale.volume}L</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel} numberOfLines={1}>Fat %</Text>
                      <Text style={[styles.detailValue, styles.noWrap]} numberOfLines={1}>{sale.fat_percentage}%</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel} numberOfLines={1}>Rate</Text>
                      <Text style={[styles.detailValue, styles.noWrap]} numberOfLines={1}>₹{sale.rate}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Add/Edit Modal */}
          <Modal visible={modalVisible} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {editMode ? 'Edit Milk Sale' : 'Add Milk Sale'}
                  </Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                      <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Volume (Liters)</Text>
                    <TextInput
                      style={styles.input}
                      value={volume}
                      onChangeText={setVolume}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Fat Percentage</Text>
                    <TextInput
                      style={styles.input}
                      value={fatPercentage}
                      onChangeText={setFatPercentage}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Rate (₹ per unit)</Text>
                    <TextInput
                      style={styles.input}
                      value={rate}
                      onChangeText={setRate}
                      keyboardType="numeric"
                      placeholder="8.4"
                    />
                  </View>

                  {volume && fatPercentage && rate && (
                    <View style={styles.calculatedBox}>
                      <Text style={styles.calculatedLabel}>Estimated Earnings:</Text>
                      <Text style={[styles.calculatedValue, styles.noWrap]} numberOfLines={1}>
                        ₹{calculateEarnings()}
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {loading ? (
                  <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} />
                ) : (
                  <TouchableOpacity
                    onPress={editMode ? handleUpdateSale : handleAddSale}
                    style={styles.submitButton}
                  >
                    <Text style={styles.submitButtonText}>
                      {editMode ? 'Update Sale' : 'Add Sale'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  container: {
    flex: 1,
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
    fontSize: 22, // FEEDBACK #3
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16, // FEEDBACK #3
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13, // FEEDBACK #3
    color: '#9CA3AF',
    marginTop: 8,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 14, // FEEDBACK #3
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardDate: {
    fontSize: 11, // FEEDBACK #3
    color: '#6B7280',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 20, // FEEDBACK #3
    fontWeight: 'bold',
    color: '#10B981',
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10, // FEEDBACK #3
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13, // FEEDBACK #3
    fontWeight: '600',
    color: '#1F2937',
  },
  // FEEDBACK #1: Transparent buttons
  editIconButton: {
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  deleteIconButton: {
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
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
  dateButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 15, // FEEDBACK #3
    color: '#1F2937',
  },
  calculatedBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculatedLabel: {
    fontSize: 13, // FEEDBACK #3
    color: '#059669',
    fontWeight: '600',
  },
  calculatedValue: {
    fontSize: 18, // FEEDBACK #3
    fontWeight: 'bold',
    color: '#10B981',
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
  // FEEDBACK #3: Prevent number wrapping
  noWrap: {
    flexShrink: 0,
  },
});
