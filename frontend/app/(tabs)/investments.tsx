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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker'; // FEEDBACK #14
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';

// FEEDBACK #3 & #9: Add background image
const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

const CATEGORIES = [
  'Shed / Infrastructure',
  'Buffalo Purchase',
  'Machinery',
  'Equipment',
  'Land',
  'Others',
];

interface Investment {
  _id: string;
  amount: number;
  date: string;
  investor: string;
  category: string;
  notes?: string;
}

export default function InvestmentsScreen() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date()); // FEEDBACK #14: Changed to Date object
  const [showDatePicker, setShowDatePicker] = useState(false); // FEEDBACK #14
  const [investor, setInvestor] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Shed / Infrastructure');
  const [notes, setNotes] = useState('');

  // Scroll to top when tab is focused
  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchInvestments();
  }, []);

  const fetchInvestments = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/investments`);
      if (response.ok) {
        const data = await response.json();
        setInvestments(data.slice(0, 20));
      }
    } catch (error) {
      console.error('Error fetching investments:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInvestments();
    setRefreshing(false);
  };

  // FEEDBACK #14: Date picker handler
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleAddInvestment = async () => {
    if (!amount) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: date.toISOString().split('T')[0], // FEEDBACK #14: Convert Date to string
          investor,
          category,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Investment added successfully');
        setModalVisible(false);
        resetForm();
        fetchInvestments();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add investment');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (investment: Investment) => {
    setEditMode(true);
    setEditingId(investment._id);
    setAmount(investment.amount.toString());
    setDate(new Date(investment.date)); // FEEDBACK #14: Convert string to Date
    setInvestor(investment.investor);
    setCategory(investment.category);
    setNotes(investment.notes || '');
    setModalVisible(true);
  };

  const handleUpdateInvestment = async () => {
    if (!amount || !editingId) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/investments/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: date.toISOString().split('T')[0], // FEEDBACK #14
          investor,
          category,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Investment updated successfully');
        setModalVisible(false);
        setEditMode(false);
        setEditingId(null);
        resetForm();
        fetchInvestments();
      } else {
        const data = await response.json();
        Alert.alert('Error', data?.detail || 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update investment');
    } finally {
      setLoading(false);
    }
  };

  // FEEDBACK #12: Delete confirmation already exists
  const handleDelete = async (id: string) => {
    if (!user?.name) {
      Alert.alert('Error', 'User not found');
      return;
    }

    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(
              `${BACKEND_URL}/api/investments/${id}?user=${user.name}`,
              { method: 'DELETE' }
            );
            if (response.ok) {
              Alert.alert('Deleted', 'Investment deleted successfully');
              fetchInvestments();
            } else {
              const data = await response.json();
              Alert.alert('Error', data?.detail || 'Delete failed');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete entry');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setAmount('');
    setDate(new Date()); // FEEDBACK #14
    setInvestor(user?.name || 'Aadil');
    setCategory('Shed / Infrastructure');
    setNotes('');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        {/* FEEDBACK #13: KeyboardAvoidingView */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Investments</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Investments List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {investments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trending-up-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No investments yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
              </View>
            ) : (
              investments.map((inv) => (
                <View key={inv._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardDate}>{inv.date}</Text>
                      <Text style={styles.cardAmount}>₹{inv.amount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.cardCategory}>{inv.category}</Text>
                      {inv.notes && <Text style={styles.cardNotes}>"{inv.notes}"</Text>}
                      <Text style={styles.cardInvestor}>By {inv.investor}</Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {/* FEEDBACK #10: Transparent background for edit/delete buttons */}
                      <TouchableOpacity
                        onPress={() => handleEdit(inv)}
                        style={styles.editIconButton}
                      >
                        <Ionicons name="create-outline" size={20} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(inv._id)}
                        style={styles.deleteIconButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Add/Edit Modal */}
          <Modal
            visible={modalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={closeModal}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalOverlay}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editMode ? 'Edit Investment' : 'Add Investment'}
                  </Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Amount (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  {/* FEEDBACK #14: Native Date Picker */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {date.toLocaleDateString('en-GB')}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                      />
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Investor</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={investor}
                        onValueChange={(value) => setInvestor(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Aadil" value="Aadil" />
                        <Picker.Item label="Imran" value="Imran" />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={category}
                        onValueChange={(value) => setCategory(value)}
                        style={styles.picker}
                      >
                        {CATEGORIES.map((cat) => (
                          <Picker.Item key={cat} label={cat} value={cat} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Optional notes"
                      multiline
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={editMode ? handleUpdateInvestment : handleAddInvestment}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {editMode ? 'Update Investment' : 'Add Investment'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // FEEDBACK #3 & #9: Transparent background
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
    fontSize: 24,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 8,
  },
  cardCategory: {
    fontSize: 12,
    color: '#6B7280',
  },
  cardNotes: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardInvestor: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  // FEEDBACK #10: Transparent edit/delete buttons
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
  // FEEDBACK #14: Date button
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
    fontSize: 16,
    color: '#1F2937',
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
