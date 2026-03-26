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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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

  const currentDate = new Date();
  const [month, setMonth] = useState((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(currentDate.toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

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
          date,
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
    setDate(now.toISOString().split('T')[0]);
    setNotes('');
  };

  const getMonthName = (monthNum: number) => MONTHS[monthNum - 1];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dairy Lock Sales</Text>
          <Text style={styles.subtitle}>Actual Payments Received</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {dlsList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No payments recorded yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first payment</Text>
          </View>
        ) : (
          dlsList.map((dls) => (
            <View key={dls._id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={styles.monthBadge}>
                    <Text style={styles.monthText}>{getMonthName(dls.month)}</Text>
                    <Text style={styles.yearText}>{dls.year}</Text>
                  </View>
                </View>
                <View style={styles.cardCenter}>
                  <Text style={styles.cardAmount}>₹{dls.amount.toLocaleString('en-IN')}</Text>
                  <Text style={styles.cardDate}>Received on {dls.date}</Text>
                  {dls.notes && <Text style={styles.cardNotes}>{dls.notes}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleDelete(dls._id)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Month</Text>
                  <View style={styles.pickerContainer}>
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

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Year</Text>
                  <View style={styles.pickerContainer}>
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
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="Enter amount received"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Payment Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleAddDLS}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Payment</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
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
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  card: {
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    marginRight: 16,
  },
  monthBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  yearText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 2,
  },
  cardCenter: {
    flex: 1,
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  cardNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: 8,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  formRow: {
    flexDirection: 'row',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
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