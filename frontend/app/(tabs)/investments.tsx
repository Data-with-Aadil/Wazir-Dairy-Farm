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

const CATEGORIES = [
  'Shed / Infrastructure',
  'Buffalo Purchase',
  'Machinery',
  'Equipment',
  'Land',
  'Others',
];

// ✅ Bulletproof Date Parser (Fixes Web Timezone/0 data bugs)
const parseDateString = (dateStr: string) => {
  if (!dateStr) return { month: 0, year: 0 };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }
  return { month: 0, year: 0 };
};

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

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ✅ Filters State (Default is 0, 0 which means 'All Time')
  const [selectedMonth, setSelectedMonth] = useState(0); 
  const [selectedYear, setSelectedYear] = useState(0);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [investor, setInvestor] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Shed / Infrastructure');
  const [notes, setNotes] = useState('');

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
        setInvestments(data);
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

  // ✅ Filter Logic (Syncs with History Cards and supports 'All Time')
  const filteredInvestments = useMemo(() => {
    return investments.filter((inv) => {
      const { month, year } = parseDateString(inv.date);

      if (selectedYear === 0) {
        return true; // "All Time" selected for year
      }
      if (selectedMonth === 0) {
        return year === selectedYear; // "All Time" in a specific year
      }
      return month === selectedMonth && year === selectedYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [investments, selectedMonth, selectedYear]);

  // ✅ Stats Logic for Summary Card
  const stats = useMemo(() => {
    const totalAmount = filteredInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const aadilAmount = filteredInvestments.filter(i => i.investor === 'Aadil').reduce((sum, inv) => sum + Number(inv.amount), 0);
    const imranAmount = filteredInvestments.filter(i => i.investor === 'Imran').reduce((sum, inv) => sum + Number(inv.amount), 0);
    return { totalAmount, aadilAmount, imranAmount };
  }, [filteredInvestments]);

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
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, 
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
    setDate(new Date(investment.date)); 
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
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, 
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
    setDate(new Date()); 
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

  // Helper to determine summary title
  const getSummaryLabel = () => {
    if (selectedYear === 0) return 'Total Investments (All Time)';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (selectedMonth === 0) return `Total Investments in ${selectedYear}`;
    return `Investments in ${monthNames[selectedMonth - 1]} ${selectedYear}`;
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Investments</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* List with Sticky Header */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickyHeaderIndices={[0]} // ✅ Makes the filter and summary card sticky
        >
          {/* ✅ Sticky Container */}
          <View style={styles.stickyContainer}>
            {/* ✅ Filter Row (Moved OUTSIDE Summary Card) */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={styles.pickerContainerOuter}>
                <Picker 
                  selectedValue={selectedMonth} 
                  onValueChange={setSelectedMonth} 
                  style={styles.picker}
                >
                  <Picker.Item label="All Time" value={0} color="#374151" />
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                    .map((m, i) => <Picker.Item key={m} label={m} value={i + 1} color="#374151" />)}
                </Picker>
              </View>
              <View style={styles.pickerContainerOuter}>
                <Picker 
                  selectedValue={selectedYear} 
                  onValueChange={setSelectedYear} 
                  style={styles.picker}
                >
                  <Picker.Item label="All Time" value={0} color="#374151" />
                  {[2024, 2025, 2026, 2027].map(y => <Picker.Item key={y} label={y.toString()} value={y} color="#374151" />)}
                </Picker>
              </View>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{getSummaryLabel()}</Text>
              <Text style={styles.grandTotal} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                ₹{stats.totalAmount.toLocaleString('en-IN')}
              </Text>
              <View style={styles.splitRow}>
                <View>
                  <Text style={styles.splitLabel}>Aadil</Text>
                  <Text style={styles.splitValue} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                    ₹{stats.aadilAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.splitDivider} />
                <View>
                  <Text style={styles.splitLabel}>Imran</Text>
                  <Text style={styles.splitValue} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                    ₹{stats.imranAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {filteredInvestments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trending-up-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>No investments found</Text>
              <Text style={styles.emptySubtext}>Try changing the filter or add new entry</Text>
            </View>
          ) : (
            filteredInvestments.map((inv) => (
              <View key={inv._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>{inv.date}</Text>
                    <Text style={styles.cardAmount} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.cardCategory}>{inv.category}</Text>
                    {inv.notes && <Text style={styles.cardNotes}>"{inv.notes}"</Text>}
                    <Text style={styles.cardInvestor}>By {inv.investor}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => handleEdit(inv)} style={styles.editIconButton}>
                      <Ionicons name="create-outline" size={20} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(inv._id)} style={styles.deleteIconButton}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            {/* ✅ Fix Point 9: Keyboard offset added */}
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
              style={styles.modalContent}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                  {editMode ? 'Edit Investment' : 'Add Investment'}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Investor</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={investor} onValueChange={(value) => setInvestor(value)} style={styles.picker}>
                      <Picker.Item label="Aadil" value="Aadil" color="#374151" />
                      <Picker.Item label="Imran" value="Imran" color="#374151" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={category} onValueChange={(value) => setCategory(value)} style={styles.picker}>
                      {CATEGORIES.map((cat) => (
                        <Picker.Item key={cat} label={cat} value={cat} color="#374151" />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, { height: 80 }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional notes"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
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
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  addButton: { backgroundColor: '#10B981', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  stickyContainer: { backgroundColor: 'rgba(255, 255, 255, 0.92)', paddingBottom: 10, paddingTop: 8 },
  pickerContainerOuter: { flex: 1, backgroundColor: '#fff', borderRadius: 10, height: 40, justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  pickerContainerInner: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  picker: { height: 40, color: '#374151' },
  summaryCard: { backgroundColor: '#1F2937', borderRadius: 15, padding: 20 },
  summaryLabel: { color: '#9CA3AF', fontSize: 12 },
  grandTotal: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 15, marginTop: 10 },
  splitLabel: { color: '#9CA3AF', fontSize: 11 },
  splitValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', flexShrink: 1 },
  splitDivider: { width: 1, backgroundColor: '#374151', height: '100%' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cardAmount: { fontSize: 24, fontWeight: 'bold', color: '#3B82F6', marginBottom: 8 },
  cardCategory: { fontSize: 12, color: '#6B7280' },
  cardNotes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  cardInvestor: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  editIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6' },
  deleteIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: '#374151' },
  dateButton: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateButtonText: { fontSize: 16, color: '#1F2937' },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
