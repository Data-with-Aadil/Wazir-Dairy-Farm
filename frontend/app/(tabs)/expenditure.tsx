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

  // Form fields
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Supplements');
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

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(
              `${BACKEND_URL}/api/expenditures/${id}?user=${user?.name}`,
              { method: 'DELETE' }
            );
            if (response.ok) {
              fetchExpenditures();
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
    setDate(new Date().toISOString().split('T')[0]);
    setPaidBy(user?.name || 'Aadil');
    setCategory('Supplements');
    setSubcategory('Mineral Mixture');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenditure</Text>
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
                  <Text style={styles.cardCategory}>
                    {exp.category} • {exp.subcategory}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardPaidBy}>Paid by {exp.paid_by}</Text>
                  <TouchableOpacity
                    onPress={() => handleDelete(exp._id)}
                    style={{ marginTop: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
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
              <Text style={styles.modalTitle}>Add Expenditure</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
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
                  keyboardType="decimal-pad"
                  placeholder="Enter amount"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Paid By</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={paidBy}
                    onValueChange={(value) => setPaidBy(value)}
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
                    onValueChange={(value) => {
                      setCategory(value);
                      setSubcategory(CATEGORIES[value as keyof typeof CATEGORIES][0]);
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
                    onValueChange={(value) => setSubcategory(value)}
                    style={styles.picker}
                  >
                    {CATEGORIES[category as keyof typeof CATEGORIES].map((subcat) => (
                      <Picker.Item key={subcat} label={subcat} value={subcat} />
                    ))}
                  </Picker>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleAddExpenditure}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Expenditure</Text>
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
    color: '#EF4444',
    marginBottom: 8,
  },
  cardCategory: {
    fontSize: 12,
    color: '#6B7280',
  },
  cardPaidBy: {
    fontSize: 12,
    color: '#6B7280',
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