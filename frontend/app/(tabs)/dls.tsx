import React, { useState, useEffect, useMemo } from 'react';
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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DLS {
  _id: string;
  month: number;
  year: number;
  amount: number;
  date: string;
  notes?: string;
}

export default function DLSScreen() {
  const { user } = useAuth();
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentDate = new Date();
  
  // ✅ Filters State
  const [filterYear, setFilterYear] = useState(currentDate.getFullYear().toString());

  // Form State
  const [month, setMonth] = useState((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [amount, setAmount] = useState('');
  
  // ✅ Fixed Date Input to use DateTimePicker instead of TextInput
  const [date, setDate] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [notes, setNotes] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchDLS();
  }, []);

  const fetchDLS = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales`);
      if (response.ok) {
        const data = await response.json();
        setDlsList(data);
      }
    } catch (error) {
      console.error('Error fetching DLS:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDLS();
    setRefreshing(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // ✅ Filter & Stats Logic
  const filteredDLS = useMemo(() => {
    return dlsList.filter((dls) => dls.year.toString() === filterYear);
  }, [dlsList, filterYear]);

  const stats = useMemo(() => {
    const totalAmount = filteredDLS.reduce((sum, dls) => sum + Number(dls.amount), 0);
    return { totalAmount };
  }, [filteredDLS]);

  const handleAddDLS = async () => {
    if (!amount) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt)) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: parseInt(month),
          year: parseInt(year),
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Dairy Lock Sale added successfully');
        setModalVisible(false);
        resetForm();
        fetchDLS();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add DLS');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dls: DLS) => {
    setEditMode(true);
    setEditingId(dls._id);
    setMonth(dls.month.toString());
    setYear(dls.year.toString());
    setAmount(dls.amount.toString());
    setDate(new Date(dls.date)); // Convert string to Date for picker
    setNotes(dls.notes || '');
    setModalVisible(true);
  };

  const handleUpdateDLS = async () => {
    if (!amount || !editingId) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt)) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales/${editingId}?user=${user?.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: parseInt(month),
          year: parseInt(year),
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'DLS updated successfully');
        setModalVisible(false);
        setEditMode(false);
        setEditingId(null);
        resetForm();
        fetchDLS();
      } else {
        Alert.alert('Error', 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update DLS');
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
            const response = await fetch(
              `${BACKEND_URL}/api/dairy-lock-sales/${id}?user=${user?.name}`,
              { method: 'DELETE' }
            );
            if (response.ok) {
              fetchDLS();
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete entry');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    const now = new Date();
    setMonth((now.getMonth() + 1).toString());
    setYear(now.getFullYear().toString());
    setAmount('');
    setDate(new Date());
    setNotes('');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const getMonthName = (monthNum: number) => MONTHS[monthNum - 1];

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Dairy Lock Sales</Text>
            <Text style={styles.subtitle} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Actual Payments Received</Text>
          </View>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* DLS List */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* ✅ Filter Row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={filterYear} onValueChange={setFilterYear} style={styles.picker}>
                {['2024', '2025', '2026', '2027'].map(y => <Picker.Item key={y} label={`Year: ${y}`} value={y} />)}
              </Picker>
            </View>
          </View>

          {/* ✅ Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Received in {filterYear}</Text>
            <Text style={styles.grandTotal} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
              ₹{stats.totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>

          {filteredDLS.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>No payments recorded yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first payment</Text>
            </View>
          ) : (
            filteredDLS.map((dls) => (
              <View key={dls._id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <View style={styles.monthBadge}>
                      <Text style={styles.monthText} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{getMonthName(dls.month)}</Text>
                      <Text style={styles.yearText} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{dls.year}</Text>
                    </View>
                  </View>
                  <View style={styles.cardCenter}>
                    <Text style={styles.cardAmount} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                      ₹{dls.amount.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.cardDate} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Received on {dls.date}</Text>
                    {dls.notes && <Text style={styles.cardNotes} numberOfLines={2}>{dls.notes}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => handleEdit(dls)} style={styles.editIconButton}>
                      <Ionicons name="create-outline" size={18} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(dls._id)} style={styles.deleteIconButton}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* ✅ Fix: KeyboardAvoidingView is now strictly wrapping the inner modal content */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                  {editMode ? 'Edit Payment' : 'Add Payment'}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Month</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker
                      selectedValue={month}
                      onValueChange={(value) => setMonth(value)}
                      style={styles.picker}
                    >
                      {MONTHS.map((m, idx) => (
                        <Picker.Item key={idx} label={m} value={(idx + 1).toString()} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Year</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker
                      selectedValue={year}
                      onValueChange={(value) => setYear(value)}
                      style={styles.picker}
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <Picker.Item key={y} label={y.toString()} value={y.toString()} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Payment Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 60 }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional"
                    multiline
                  />
                </View>
              </ScrollView>

              {loading ? (
                <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} />
              ) : (
                <TouchableOpacity
                  onPress={editMode ? handleUpdateDLS : handleAddDLS}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>
                    {editMode ? 'Update Payment' : 'Add Payment'}
                  </Text>
                </TouchableOpacity>
              )}
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
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
  pickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 45,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerContainerInner: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  summaryCard: {
    backgroundColor: '#1F2937',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  grandTotal: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    marginRight: 12,
  },
  monthBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  monthText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  yearText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 2,
  },
  cardCenter: {
    flex: 1,
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  cardNotes: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
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
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
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
    fontSize: 15,
    color: '#1F2937',
  },
  submitButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
