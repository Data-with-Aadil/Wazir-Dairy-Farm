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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BACKGROUND_IMAGE = require('../../assets/images/0vjmy7gj_1000044672.jpg');
const BACKEND_URL = "https://wazir-dairy-farm-1.onrender.com";

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

interface Bill {
  _id: string;
  image: string;
  description: string;
  amount?: number;
  date: string;
  uploaded_by: string;
  created_at: string;
}

export default function ExpenditureScreen() {
  const { user } = useAuth();
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [activeTab, setActiveTab] = useState<'expenditures' | 'bills'>('expenditures');
  const [modalVisible, setModalVisible] = useState(false);
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Expenditure form states
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Supplements');
  const [subcategory, setSubcategory] = useState('Mineral Mixture');
  const [notes, setNotes] = useState('');

  // Bill form states with separate date picker
  const [billImage, setBillImage] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);

  // --- ✅ CHANGE #1: Filter States & Summary Logic ---
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = All Time
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const MONTHS = ['All Time', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const YEARS = [2024, 2025, 2026];

  // ✅ Aadil & Imran Split Logic
  const stats = useMemo(() => {
    const filtered = expenditures.filter(exp => {
      if (selectedMonth === 0) return true;
      const expDate = new Date(exp.date);
      return (expDate.getMonth() + 1 === selectedMonth) && (expDate.getFullYear() === selectedYear);
    });

    const aadilTotal = filtered
      .filter(e => e.paid_by === 'Aadil')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const imranTotal = filtered
      .filter(e => e.paid_by === 'Imran')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    return { 
      aadilTotal, 
      imranTotal, 
      grandTotal: aadilTotal + imranTotal,
      list: filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [expenditures, selectedMonth, selectedYear]);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchExpenditures();
    fetchBills();
  }, []);

  const fetchExpenditures = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/expenditures`);
      if (response.ok) {
        const data = await response.json();
        setExpenditures(data);
      }
    } catch (error) {
      console.error('Error fetching expenditures:', error);
    }
  };

  const fetchBills = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/bills`);
      if (response.ok) {
        const data = await response.json();
        setBills(data);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchExpenditures(), fetchBills()]);
    setRefreshing(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onBillDateChange = (event: any, selectedDate?: Date) => {
    setShowBillDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBillDate(selectedDate);
    }
  };

  // ✅ Image picker with compression
  const pickImage = async (useCamera: boolean) => {
    try {
      setLoading(true);

      const { status } = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera/gallery permission');
        setLoading(false);
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            allowsEditing: false,
          });

      if (!result.canceled && result.assets[0]) {
        // Compress image to reduce size
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipulatedImage.base64) {
          setBillImage(`data:image/jpeg;base64,${manipulatedImage.base64}`);
          console.log('✅ Image compressed and ready for upload');
        } else {
          Alert.alert('Error', 'Failed to process image');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Upload bill with proper validation and error handling
  const handleUploadBill = async () => {
    if (!billImage) {
      Alert.alert('Error', 'Please select an image');
      return;
    }

    if (!billDescription.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    setLoading(true);
    try {
      const billData: any = {
        image: billImage,
        description: billDescription.trim(),
        date: billDate.toISOString().split('T')[0],
        uploaded_by: user?.name || 'Unknown',
      };

      // Only add amount if provided and valid
      if (billAmount && parseFloat(billAmount) > 0) {
        billData.amount = parseFloat(billAmount);
      } else {
        billData.amount = 0; // Backend expects amount field
      }

      console.log('📤 Uploading bill:', {
        description: billData.description,
        amount: billData.amount,
        date: billData.date,
        imageSize: billImage.length,
      });

      const response = await fetch(`${BACKEND_URL}/api/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Bill uploaded successfully:', result);
        Alert.alert('Success', 'Bill uploaded successfully');
        setBillModalVisible(false);
        resetBillForm();
        fetchBills();
      } else {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        Alert.alert('Error', 'Failed to upload bill. Please try again.');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      Alert.alert('Error', 'Failed to upload bill. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Download bill with proper file naming
  const handleDownloadBill = async (bill: Bill) => {
    try {
      const sanitizedDesc = bill.description.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const fileName = `bill_${sanitizedDesc}_${bill.date}.jpg`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // Remove base64 prefix if exists
      const base64Data = bill.image.replace(/^data:image\/\w+;base64,/, '');

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Download Bill',
        });
        console.log('✅ Bill downloaded:', fileName);
      } else {
        Alert.alert('Success', `Bill saved to ${fileUri}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download bill');
    }
  };

  const handleDeleteBill = async (id: string) => {
    Alert.alert('Delete Bill', 'Are you sure you want to delete this bill?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/bills/${id}?user=${user?.name}`, {
              method: 'DELETE',
            });
            if (response.ok) {
              Alert.alert('Deleted', 'Bill deleted successfully');
              fetchBills();
            } else {
              Alert.alert('Error', 'Failed to delete bill');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete bill');
          }
        },
      },
    ]);
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
      } else {
        Alert.alert('Error', 'Failed to add expenditure');
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

    Alert.alert('Delete Entry', 'Are you sure?', [
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

  const resetBillForm = () => {
    setBillImage('');
    setBillDescription('');
    setBillAmount('');
    setBillDate(new Date());
    console.log('✅ Bill form reset');
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const closeBillModal = () => {
    setBillModalVisible(false);
    resetBillForm();
  };

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        {/* ✅ FEEDBACK #3: KeyboardAvoidingView wrapper */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Expenditure</Text>
            <TouchableOpacity
              onPress={() =>
                activeTab === 'expenditures' ? setModalVisible(true) : setBillModalVisible(true)
              }
              style={styles.addButton}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenditures' && styles.activeTab]}
              onPress={() => setActiveTab('expenditures')}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color={activeTab === 'expenditures' ? '#fff' : '#6B7280'}
              />
              <Text style={[styles.tabText, activeTab === 'expenditures' && styles.activeTabText]}>
                Expenditures
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'bills' && styles.activeTab]}
              onPress={() => setActiveTab('bills')}
            >
              <Ionicons
                name="image-outline"
                size={18}
                color={activeTab === 'bills' ? '#fff' : '#6B7280'}
              />
              <Text style={[styles.tabText, activeTab === 'bills' && styles.activeTabText]}>
                Bills
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {activeTab === 'expenditures' ? (
              <>
                {/* ✅ CHANGE #2: Filter Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  <View style={styles.filterPickerContainer}>
                    <Picker selectedValue={selectedMonth} onValueChange={setSelectedMonth}>
                      {MONTHS.map((m, i) => <Picker.Item key={m} label={m} value={i} />)}
                    </Picker>
                  </View>
                  <View style={styles.filterPickerContainer}>
                    <Picker selectedValue={selectedYear} onValueChange={setSelectedYear}>
                      {YEARS.map(y => <Picker.Item key={y} label={y.toString()} value={y} />)}
                    </Picker>
                  </View>
                </View>

                {/* ✅ CHANGE #2: Summary Card (Aadil vs Imran) */}
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Expenditure</Text>
                  <Text style={styles.grandTotal}>₹{stats.grandTotal.toLocaleString('en-IN')}</Text>
                  <View style={styles.splitRow}>
                    <View>
                      <Text style={styles.splitLabel}>Aadil</Text>
                      <Text style={styles.splitValue}>₹{stats.aadilTotal.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.splitDivider} />
                    <View>
                      <Text style={styles.splitLabel}>Imran</Text>
                      <Text style={styles.splitValue}>₹{stats.imranTotal.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                {/* ✅ CHANGE #2: Use stats.list.map instead of expenditures.map */}
                {stats.list.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyText}>No expenditures yet</Text>
                    <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
                  </View>
                ) : (
                  stats.list.map((exp) => (
                    <View key={exp._id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View>
                          <Text style={styles.cardDate}>{exp.date}</Text>
                          <Text style={styles.cardAmount}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                        </View>
                        {/* ✅ CHANGE #3: flex: 1 + flexWrap to prevent text cutting */}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.cardCategory, { flexWrap: 'wrap' }]}>
                            {exp.category} • {exp.subcategory}
                          </Text>
                          {exp.notes && (
                            <Text style={styles.cardNotes} numberOfLines={1}>
                              {exp.notes}
                            </Text>
                          )}
                          <Text style={styles.cardPaidBy}>Paid by {exp.paid_by}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity onPress={() => handleEdit(exp)} style={styles.editIconButton}>
                          <Ionicons name="pencil" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(exp._id)} style={styles.deleteIconButton}>
                          <Ionicons name="trash" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : (
              // Bills List
              bills.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="image-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No bills yet</Text>
                  <Text style={styles.emptySubtext}>Tap + to upload your first bill</Text>
                </View>
              ) : (
                bills.map((bill) => (
                  <View key={bill._id} style={styles.billCard}>
                    <Image source={{ uri: bill.image }} style={styles.billImage} resizeMode="cover" />
                    <View style={styles.billInfo}>
                      <Text style={styles.billDescription} numberOfLines={1}>
                        {bill.description}
                      </Text>
                      {bill.amount && bill.amount > 0 && (
                        <Text style={styles.billAmount}>₹{bill.amount.toLocaleString('en-IN')}</Text>
                      )}
                      <Text style={styles.billDate}>{bill.date}</Text>
                      <Text style={styles.billUploader}>By {bill.uploaded_by}</Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {/* ✅ Download button */}
                      <TouchableOpacity
                        onPress={() => handleDownloadBill(bill)}
                        style={styles.downloadIconButton}
                      >
                        <Ionicons name="download" size={16} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteBill(bill._id)}
                        style={styles.deleteIconButton}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Add/Edit Expenditure Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editMode ? 'Edit Expenditure' : 'Add Expenditure'}
                  </Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Amount (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                      placeholder="Enter amount"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                      <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
                    )}
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
                      style={[styles.input, { height: 80 }]}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      placeholder="Optional notes"
                      textAlignVertical="top"
                    />
                  </View>
                </ScrollView>

                {loading ? (
                  <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 16 }} />
                ) : (
                  <TouchableOpacity
                    onPress={editMode ? handleUpdateExpenditure : handleAddExpenditure}
                    style={styles.submitButton}
                  >
                    <Text style={styles.submitButtonText}>
                      {editMode ? 'Update Expenditure' : 'Add Expenditure'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Upload Bill Modal */}
        <Modal visible={billModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContent}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Upload Bill</Text>
                  <TouchableOpacity onPress={closeBillModal}>
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Image Preview */}
                  {billImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: billImage }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity
                        onPress={() => setBillImage('')}
                        style={styles.removeImageButton}
                      >
                        <Ionicons name="close-circle" size={32} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.imagePickerContainer}>
                      <TouchableOpacity
                        onPress={() => pickImage(false)}
                        style={styles.imagePickerButton}
                        disabled={loading}
                      >
                        <Ionicons name="images-outline" size={32} color="#10B981" />
                        <Text style={styles.imagePickerText}>Gallery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => pickImage(true)}
                        style={styles.imagePickerButton}
                        disabled={loading}
                      >
                        <Ionicons name="camera-outline" size={32} color="#10B981" />
                        <Text style={styles.imagePickerText}>Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={billDescription}
                      onChangeText={setBillDescription}
                      placeholder="e.g., Medicine Bill, Feed Purchase"
                      maxLength={50}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Amount (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={billAmount}
                      onChangeText={setBillAmount}
                      keyboardType="numeric"
                      placeholder="Enter amount if visible on bill"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity
                      onPress={() => setShowBillDatePicker(true)}
                      style={styles.dateButton}
                    >
                      <Text style={styles.dateButtonText}>{billDate.toLocaleDateString('en-GB')}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    {showBillDatePicker && (
                      <DateTimePicker
                        value={billDate}
                        mode="date"
                        display="default"
                        onChange={onBillDateChange}
                      />
                    )}
                  </View>
                </ScrollView>

                {loading ? (
                  <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 16 }} />
                ) : (
                  <TouchableOpacity
                    onPress={handleUploadBill}
                    style={[styles.submitButton, !billImage && styles.submitButtonDisabled]}
                    disabled={!billImage}
                  >
                    <Text style={styles.submitButtonText}>Upload Bill</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  addButton: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ✅ CHANGE #4: New dark-themed Summary Card styles
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
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 15,
    marginTop: 10,
  },
  splitLabel: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  splitValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  splitDivider: {
    width: 1,
    backgroundColor: '#374151',
    height: '100%',
  },
  // ✅ CHANGE #4: Filter picker style
  filterPickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 45,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardDate: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 6,
  },
  cardCategory: {
    fontSize: 11,
    color: '#6B7280',
  },
  cardNotes: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardPaidBy: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
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
  downloadIconButton: {
    padding: 8,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  billCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  billImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  billInfo: {
    flex: 1,
  },
  billDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 2,
  },
  billDate: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  billUploader: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  imagePickerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  imagePickerButton: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
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
    fontSize: 15,
    fontWeight: '600',
  },
  noWrap: {
    flexShrink: 0,
  },
});
