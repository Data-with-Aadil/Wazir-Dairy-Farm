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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = "https://wazir-dairy-farm.onrender.com";

const CATEGORIES = {
  Supplements: ['Mineral Mixture', 'Calcium', 'Bypass Fat', 'Bypass Protein', 'Yeast Culture', 'Toxin Binder', 'Liver Tonic', 'Probiotics', 'Electrolytes', 'Others'],
  Fodder: ['Sukha Chara', 'Hara Chara', 'Silage', 'Others'],
  Feed: ['Gud', 'Makka', 'Gehu Churi', 'Chana Churi', 'Jowar', 'Bajra', 'Binola', 'Soybean Khal', 'Mustard Khal', 'Groundnut Khal', 'Salt', 'Soda', 'Others'],
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

  // Form fields
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState<keyof typeof CATEGORIES>('Supplements');
  const [subcategory, setSubcategory] = useState('Mineral Mixture');
  const [notes, setNotes] = useState('');

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
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/expenditures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date,
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

  const handleDelete = (id: string) => {
    if (!user?.name) {
      Alert.alert('Error', 'User not found');
      return;
    }
    
    Alert.alert('Delete Entry', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const url = `${BACKEND_URL}/api/expenditures/${id}?user=${user.name}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
              Alert.alert('Deleted', 'Entry removed');
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
    setDate(new Date().toISOString().split('T')[0]);
    setPaidBy(user?.name || 'Aadil');
    setCategory('Supplements');
    setSubcategory(CATEGORIES['Supplements'][0]);
    setNotes('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Expenditure</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {expenditures.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No expenditures yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
          </View>
        ) : (
          expenditures.map((exp) => (
            <View key={exp._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardDate}>{exp.date}</Text>
                  <Text style={styles.cardAmount}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                  <Text style={styles.cardCategory}>{exp.category} • {exp.subcategory}</Text>
                  {exp.notes && <Text style={styles.cardNotes}>"{exp.notes}"</Text>}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardPaidBy}>By {exp.paid_by}</Text>
                  <TouchableOpacity onPress={() => handleDelete(exp._id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Entry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount (₹)</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={category}
                    onValueChange={(val: keyof typeof CATEGORIES) => {
                      setCategory(val);
                      setSubcategory(CATEGORIES[val][0]);
                    }}
                  >
                    {Object.keys(CATEGORIES).map(cat => <Picker.Item key={cat} label={cat} value={cat} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Subcategory</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={subcategory} onValueChange={(val) => setSubcategory(val)}>
                    {CATEGORIES[category].map(sub => <Picker.Item key={sub} label={sub} value={sub} />)}
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput 
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                  value={notes} 
                  onChangeText={setNotes} 
                  placeholder="Optional details..." 
                  multiline 
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
                onPress={handleAddExpenditure} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Expenditure</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  addButton: { backgroundColor: '#10B981', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDate: { fontSize: 12, color: '#6B7280' },
  cardAmount: { fontSize: 22, fontWeight: 'bold', color: '#EF4444', marginVertical: 4 },
  cardCategory: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  cardNotes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  cardPaidBy: { fontSize: 12, color: '#6B7280' },
  deleteBtn: { marginTop: 12, padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, fontSize: 16 },
  pickerContainer: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 10 },
  emptySubtext: { color: '#9CA3AF' },
});
