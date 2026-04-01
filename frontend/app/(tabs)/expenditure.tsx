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

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidBy, setPaidBy] = useState(user?.name || 'Aadil');
  const [category, setCategory] = useState('Supplements');
  const [subcategory, setSubcategory] = useState('Mineral Mixture');
  const [notes, setNotes] = useState('');

  // ✅ FEEDBACK #2: Bill form fields
  const [billImage, setBillImage] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);

  const [aadilTotal, setAadilTotal] = useState(0);
  const [imranTotal, setImranTotal] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchExpenditures();
    fetchBills();
  }, []);

  useEffect(() => {
    const aadil = expenditures
      .filter((e) => e.paid_by === 'Aadil')
      .reduce((sum, e) => sum + e.amount, 0);
    const imran = expenditures
      .filter((e) => e.paid_by === 'Imran')
      .reduce((sum, e) => sum + e.amount, 0);
    setAadilTotal(aadil);
    setImranTotal(imran);
  }, [expenditures]);

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
    await fetchExpenditures();
    await fetchBills();
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

  // ✅ FEEDBACK #2: Fixed image picker with compression
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
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            allowsEditing: true,
          });

      if (!result.canceled && result.assets[0]) {
        // Compress image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipulatedImage.base64) {
          setBillImage(`data:image/jpeg;base64,${manipulatedImage.base64}`);
          console.log('✅ Image compressed and set');
        }
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FEEDBACK #2: Fixed bill upload with proper error handling
  const handleUploadBill = async () => {
    if (!billImage) {
      Alert.alert('Error', 'Please select an image');
      return;
    }

    if (!billDescription.trim()) {
      Alert.alert('Error', 'Please enter description');
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

      if (billAmount && parseFloat(billAmount) > 0) {
        billData.amount = parseFloat(billAmount);
      }

      console.log('📤 Uploading bill...');

      const response = await fetch(`${BACKEND_URL}/api/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      });

      if (response.ok) {
        console.log('✅ Bill uploaded successfully');
        Alert.alert('Success', 'Bill uploaded successfully');
        setBillModalVisible(false);
        resetBillForm();
        fetchBills();
      } else {
        const errorText = await response.text();
        console.error('❌ Upload failed:', errorText);
        Alert.alert('Error', 'Failed to upload bill. Please try again.');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      Alert.alert('Error', 'Failed to upload bill. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FEEDBACK #2: Download bill as JPEG
  const handleDownloadBill = async (bill: Bill) => {
    try {
      const fileName = `bill_${bill.description.replace(/\s+/g, '_')}_${bill.date}.jpg`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // Remove base64 prefix
      const base64Data = bill.image.replace(/^data:image\/\w+;base64,/, '');

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Download Bill',
      });

      Alert.alert('Success', 'Bill downloaded successfully');
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

  // ✅ FEEDBACK #2: Reset bill form
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
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background}>
      {/* ✅ FEEDBACK #3: KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
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

          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Expenditure</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Aadil</Text>
                <Text style={styles.summaryValue}>₹{aadilTotal.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Imran</Text>
                <Text style={styles.summaryValue}>₹{imranTotal.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenditures' && styles.activeTab]}
              onPress={() => setActiveTab('expenditures')}
            >
              <Ionicons
                name="wallet"
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
                name="receipt"
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
              // Expenditures List
              expenditures.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No expenditures yet</Text>
                  <Text style={styles.emptySubtext}>Tap + to add your first entry</Text>
                </View>
              ) : (
                expenditures.map((exp) => (
                  <View key={exp._id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardDate}>{exp.date}</Text>
                        <Text style={styles.cardAmount} numberOfLines={1} ellipsizeMode="tail">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.cardCategory} numberOfLines={1} ellipsizeMode="tail">
                          {exp.category} • {exp.subcategory}
                        </Text>
                        {exp.notes && (
                          <Text style={styles.cardNotes} numberOfLines={2} ellipsizeMode="tail">
                            {exp.notes}
                          </Text>
                        )}
                        <Text style={styles.cardPaidBy}>Paid by {exp.paid_by}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => handleEdit(exp)} style={styles.editIconButton}>
                          <Ionicons name="pencil" size={18} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(exp._id)} style={styles.deleteIconButton}>
                          <Ionicons name="trash" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )
            ) : (
              // Bills List
              bills.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
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
                      {bill.amount && (
                        <Text style={styles.billAmount}>₹{bill.amount.toLocaleString('en-IN')}</Text>
                      )}
                      <Text style={styles.billDate}>{bill.date}</Text>
                      <Text style={styles.billUploader}>By {bill.uploaded_by}</Text>
                    </View>
                    <View style={{ flexDirection: 'column', gap: 8 }}>
                      {/* ✅ FEEDBACK #2: Download button */}
                      <TouchableOpacity
                        onPress={() => handleDownloadBill(bill)}
                        style={styles.downloadIconButton}
                      >
                        <Ionicons name="download" size={18} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteBill(bill._id)}
                        style={styles.deleteIconButton}
                      >
                        <Ionicons name="trash" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )
            )}
          </ScrollView>

          {/* Add/Edit Expenditure Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={closeModal}
          >
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContent}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editMode ? 'Edit Expenditure' : 'Add Expenditure'}
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
                      placeholder="Enter amount"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                      <Ionicons name="calendar" size={20} color="#6B7280" />
                      <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                      />
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Paid By</Text>
                    <View style={styles.pickerContainer}>
                      <Picker selectedValue={paidBy} onValueChange={(value) => setPaidBy(value)} style={styles.picker}>
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
                      placeholder="Add notes..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>

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
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* Upload Bill Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={billModalVisible}
            onRequestClose={closeBillModal}
          >
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalContent}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Upload Bill</Text>
                  <TouchableOpacity onPress={closeBillModal}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Image Preview */}
                  {billImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: billImage }} style={styles.imagePreview} resizeMode="contain" />
                      <TouchableOpacity onPress={() => setBillImage('')} style={styles.removeImageButton}>
                        <Ionicons name="close-circle" size={32} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.imagePickerContainer}>
                      <TouchableOpacity onPress={() => pickImage(false)} style={styles.imagePickerButton}>
                        <Ionicons name="images" size={32} color="#10B981" />
                        <Text style={styles.imagePickerText}>Gallery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => pickImage(true)} style={styles.imagePickerButton}>
                        <Ionicons name="camera" size={32} color="#10B981" />
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
                      placeholder="E.g., Feed Purchase, Medicine"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Amount (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={billAmount}
                      onChangeText={setBillAmount}
                      placeholder="Enter amount"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TouchableOpacity onPress={() => setShowBillDatePicker(true)} style={styles.dateButton}>
                      <Ionicons name="calendar" size={20} color="#6B7280" />
                      <Text style={styles.dateButtonText}>{billDate.toLocaleDateString('en-GB')}</Text>
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

                  {loading ? (
                    <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 16 }} />
                  ) : (
                    <TouchableOpacity onPress={handleUploadBill} style={styles.submitButton}>
                      <Text style={styles.submitButtonText}>Upload Bill</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </View>
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
  addButton: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
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
