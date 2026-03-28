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
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm.onrender.com";

const CATEGORIES = {
  Supplements: [
    'Mineral Mixture',
    'Calcium',
    'Bypass Fat',
    'Bypass Protein',
    'Yeast Culture',
    'Toxin Binder',
    'Liver Tonic',
    'Probiotics',
    'Electrolytes',
    'Others',
  ],
  Fodder: ['Sukha Chara', 'Hara Chara', 'Silage', 'Others'],
  Feed: [
    'Gud',
    'Makka',
    'Gehu Churi',
    'Chana Churi',
    'Jowar',
    'Bajra',
    'Binola',
    'Soybean Khal',
    'Mustard Khal',
    'Groundnut Khal',
    'Salt',
    'Soda',
    'Others',
  ],
  Others: ['Labour', 'Electricity', 'Veterinary', 'Transport', 'Maintenance', 'Others'],
};

interface Expenditure {
  _id: string;
  amount: number;
  date: string;
  paid_by: string;
  category: string;
  subcategory: string;
  notes?: string;
}

export default function ExpenditureScreen() {
  const { user } = useAuth();
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Supplements');
  const [subcategory, setSubcategory] = useState('Mineral Mixture');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchExpenditures();
  }, []);

  const fetchExpenditures = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/expenditures`);
      if (response.ok) {
        const data = await response.json();
        setExpenditures(data.slice(0, 20));
      }
    } catch (error) {
      console.error('Error fetching expenditures:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchExpenditures();
    setRefreshing(false);
  };

  const handleAddExpenditure = async () => {
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
      const response = await fetch(`${BACKEND_URL}/api/expenditures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: date.toISOString().split('T')[0],
          paid_by: paidBy,
          category,
          subcategory,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Expenditure added successfully');
        setModalVisible(false);
        resetForm();
        fetchExpenditures();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add expenditure');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (expenditure: Expenditure) => {
    setEditMode(true);
    setEditingId(expenditure._id);
    setAmount(expenditure.amount.toString());
    setDate(new Date(expenditure.date));
    setPaidBy(expenditure.paid_by);
    setCategory(expenditure.category);
    setSubcategory(expenditure.subcategory);
    setNotes(expenditure.notes || '');
    setModalVisible(true);
  };

  const handleUpdateExpenditure = async () => {
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
      const response = await fetch(`${BACKEND_URL}/api/expenditures/${editingId}?user=${user?.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: date.toISOString().split('T')[0],
          paid_by: paidBy,
          category,
          subcategory,
          notes: notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Expenditure updated successfully');
        setModalVisible(false);
        setEditMode(false);
        setEditingId(null);
        resetForm();
        fetchExpenditures();
      } else {
        const data = await response.json();
        Alert.alert('Error', data?.detail || 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update expenditure');
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
            const url = `${BACKEND_URL}/api/expenditures/${id}?user=${user.name}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
              Alert.alert('Deleted', 'Entry deleted successfully');
              fetchExpenditures();
            } else {
              const data = await res.json();
              Alert.alert('Error', data?.detail || 'Delete failed');
            }
          } catch (err) {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setAmount('');
    setDate(new Date());
    setPaidBy(user?.name || 'Aadil');
    setCategory('Supplements');
    setSubcategory(CATEGORIES['Supplements'][0]);
    setNotes('');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Expenditure</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {expenditures.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No expenditures yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
              </View>
            ) : (
              expenditures.map((exp) => (
                <View key={exp._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardDate}>{exp.date}</Text>
                      <Text style={styles.cardAmount} numberOfLines={1}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.cardCategory}>{exp.category} • {exp.subcategory}</Text>
                      {exp.notes && <Text style={styles.cardNotes}>"{exp.notes}"</Text>}
                      <Text style={styles.cardPaidBy}>Paid by {exp.paid_by}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => handleEdit(exp)} style={styles.editIconButton}>
                        <Ionicons name="create-outline" size={20} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(exp._id)} style={styles.deleteIconButton}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={closeModal}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editMode ? 'Edit Expenditure' : 'Add Expenditure'}</Text>
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
                      placeholder="Enter amount"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                      <Text style={styles.dateText}>{date.toISOString().split('T')[0]}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                      />
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={category}
                        onValueChange={(value) => {
                          const cat = value as keyof typeof CATEGORIES;
                          setCategory(cat);
                          setSubcategory(CATEGORIES[cat][0]);
                        }}
                        style={styles.picker}
                      >
                        {Object.keys(CATEGORIES).map((cat) => (
                          <Picker.Item key={cat} label={cat} value={cat} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Subcategory</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={subcategory}
                        onValueChange={(value) => setSubcategory(value as string)}
                        style={styles.picker}
                      >
                        {CATEGORIES[category as keyof typeof CATEGORIES]?.map((subcat) => (
                          <Picker.Item key={subcat} label={subcat} value={subcat} />
                        ))}
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Notes</Text>
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
                    onPress={editMode ? handleUpdateExpenditure : handleAddExpenditure}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {editMode ? 'Update Expenditure' : 'Add Expenditure'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  addButton: { backgroundColor: '#10B981', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cardAmount: { fontSize: 24, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 },
  cardCategory: { fontSize: 12, color: '#6B7280' },
  cardNotes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  cardPaidBy: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  editIconButton: { padding: 8, backgroundColor: 'transparent' },
  deleteIconButton: { padding: 8, backgroundColor: 'transparent' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: '#1F2937' },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16 },
  dateText: { fontSize: 16, color: '#1F2937' },
  pickerContainer: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  picker: { height: 50 },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
