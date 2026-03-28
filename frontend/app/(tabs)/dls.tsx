import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';

const API_URL = 'YOUR_BACKEND_URL'; // Replace with your actual backend URL

interface DairyLockSale {
  id: string;
  earnings: number;
  date: string;
  deleted: boolean;
}

export default function DLSScreen() {
  const { user } = useAuth();
  const [sales, setSales] = useState<DairyLockSale[]>([]);
  const [earnings, setEarnings] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dairy-lock-sales`);
      const data = await response.json();
      setSales(data.filter((sale: DairyLockSale) => !sale.deleted));
    } catch (error) {
      console.error('Error fetching DLS:', error);
    }
  };

  const handleSubmit = async () => {
    if (!earnings) {
      Alert.alert('Error', 'Please enter earnings amount');
      return;
    }

    const saleData = {
      earnings: parseFloat(earnings),
      date: date.toISOString().split('T')[0],
      created_by: user?.name || 'Unknown',
      deleted: false,
    };

    try {
      if (editingId) {
        // Update existing sale
        await fetch(`${API_URL}/api/dairy-lock-sales/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        });
      } else {
        // Create new sale
        await fetch(`${API_URL}/api/dairy-lock-sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        });
      }

      setEarnings('');
      setDate(new Date());
      setEditingId(null);
      fetchSales();
    } catch (error) {
      console.error('Error saving DLS:', error);
      Alert.alert('Error', 'Failed to save dairy lock sale');
    }
  };

  const handleEdit = (sale: DairyLockSale) => {
    setEarnings(sale.earnings.toString());
    setDate(new Date(sale.date));
    setEditingId(sale.id);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this dairy lock sale?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/dairy-lock-sales/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleted: true }),
              });
              fetchSales();
            } catch (error) {
              console.error('Error deleting DLS:', error);
              Alert.alert('Error', 'Failed to delete dairy lock sale');
            }
          },
        },
      ]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB');
  };

  const netDLS = sales.reduce((sum, sale) => sum + sale.earnings, 0);

  return (
    <ImageBackground
      source={require('../../assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Form Section */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {editingId ? 'Edit Dairy Lock Sale' : 'Add Dairy Lock Sale'}
            </Text>

            {/* Earnings Input */}
            <Text style={styles.label}>Earnings (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter earnings"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={earnings}
              onChangeText={setEarnings}
            />

            {/* Date Picker */}
            <Text style={styles.label}>Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {date.toLocaleDateString('en-GB')}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
              />
            )}

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>
                {editingId ? 'Update Sale' : 'Add Sale'}
              </Text>
            </TouchableOpacity>

            {editingId && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditingId(null);
                  setEarnings('');
                  setDate(new Date());
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Net DLS Display */}
          <View style={styles.netDLSContainer}>
            <Text style={styles.netDLSLabel}>Net DLS:</Text>
            <Text style={styles.netDLSAmount}>₹{netDLS.toLocaleString('en-IN')}</Text>
          </View>

          {/* Sales List */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Dairy Lock Sales History</Text>
            <FlatList
              data={sales}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.saleCard}>
                  <View style={styles.saleInfo}>
                    <Text style={styles.saleAmount}>
                      ₹{item.earnings.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.saleDate}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEdit(item)}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(item.id)}
                    >
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No dairy lock sales yet</Text>
              }
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  submitButton: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  netDLSContainer: {
    backgroundColor: 'rgba(155, 89, 182, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netDLSLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  netDLSAmount: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  saleInfo: {
    flex: 1,
  },
  saleAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9b59b6',
    marginBottom: 4,
  },
  saleDate: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  actionButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#95a5a6',
    fontSize: 16,
    marginTop: 20,
  },
});
