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

// ✅ Bulletproof Date Parser (Fixes Web Timezone/0 data bugs)
const parseDateString = (dateStr: string) => {
  if (!dateStr) return { month: 0, year: 0 };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }
  return { month: 0, year: 0 };
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

  // ✅ Filter States (Default is Current Month)
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); 
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const MONTHS = ['All Time', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYearForArray = new Date().getFullYear();
  // यह 2024 से लेकर (Current Year + 2) तक का डायनामिक ऐरे बनाएगा
  const YEARS = Array.from({ length: (currentYearForArray + 2) - 2024 + 1 }, (_, i) => 2024 + i);

  // ✅ Aadil & Imran Split Logic (Syncs with bulletproof filter)
  const stats = useMemo(() => {
    const filtered = expenditures.filter(exp => {
      const { month, year } = parseDateString(exp.date);
      if (selectedMonth === 0) return year === selectedYear;
      return month === selectedMonth && year === selectedYear;
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

  // ✅ Bills Filter Logic (Syncs with bulletproof filter)
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const { month, year } = parseDateString(bill.date);
      if (selectedMonth === 0) return year === selectedYear;
      return month === selectedMonth && year === selectedYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, selectedMonth, selectedYear]);

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
    if (selectedDate) setDate(selectedDate);
  };

  const onBillDateChange = (event: any, selectedDate?: Date) => {
    setShowBillDatePicker(Platform.OS === 'ios');
    if (selectedDate) setBillDate(selectedDate);
  };

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
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, allowsEditing: false });

      if (!result.canceled && result.assets[0]) {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 600 } }], 
          { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true } 
        );
        if (manipulatedImage.base64) {
          setBillImage(`data:image/jpeg;base64,${manipulatedImage.base64}`);
        } else {
          Alert.alert('Error', 'Failed to process image');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBill = async () => {
    if (!billImage) return Alert.alert('Error', 'Please select an image');
    if (!billDescription.trim()) return Alert.alert('Error', 'Please enter a description');

    setLoading(true);
    try {
      const billData: any = {
        image: billImage,
        description: billDescription.trim(),
        date: `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}-${String(billDate.getDate()).padStart(2, '0')}`,
        uploaded_by: user?.name || 'Unknown',
      };
      if (billAmount && parseFloat(billAmount) > 0) {
        billData.amount = parseFloat(billAmount);
      } else {
        billData.amount = 0; 
      }

      const response = await fetch(`${BACKEND_URL}/api/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      });

      if (response.ok) {
        Alert.alert('Success', 'Bill uploaded successfully');
        setBillModalVisible(false);
        resetBillForm();
        fetchBills();
      } else {
        Alert.alert('Error', 'Failed to upload bill.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload bill.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Web + Mobile Download Logic Fix
  const handleDownloadBill = async (bill: Bill) => {
    try {
      const sanitizedDesc = bill.description.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const fileName = `bill_${sanitizedDesc}_${Date.now()}.jpg`;

      // 🌐 WEB LOGIC
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = bill.image; // Assuming it's already a base64 data URI
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.alert('✅ Bill downloaded successfully!');
      } 
      // 📱 MOBILE LOGIC
      else {
        const fileUri = FileSystem.cacheDirectory + fileName;
        const base64Data = bill.image.replace(/^data:image\/\w+;base64,/, '');

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Download Bill',
          });
        } else {
          Alert.alert('Success', 'Bill saved to device');
        }
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
            const response = await fetch(`${BACKEND_URL}/api/bills/${id}?user=${user?.name}`, { method: 'DELETE' });
            if (response.ok) {
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
    if (!amount) return Alert.alert('Error', 'Please enter amount');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Error', 'Please enter valid amount');

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/expenditures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
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
    if (!amount || !editingId) return Alert.alert('Error', 'Please enter amount');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return Alert.alert('Error', 'Please enter valid amount');

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/expenditures/${editingId}?user=${user?.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
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
        Alert.alert('Error', 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update expenditure');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.name) return;
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
              fetchExpenditures();
            } else {
              Alert.alert('Error', 'Delete failed');
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
        <View style={styles.header}>
          <Text style={styles.title}>Expenditure</Text>
          <TouchableOpacity
            onPress={() => activeTab === 'expenditures' ? setModalVisible(true) : setBillModalVisible(true)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'expenditures' && styles.activeTab]}
            onPress={() => setActiveTab('expenditures')}
          >
            <Ionicons name="receipt-outline" size={18} color={activeTab === 'expenditures' ? '#fff' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'expenditures' && styles.activeTabText]}>Expenditures</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bills' && styles.activeTab]}
            onPress={() => setActiveTab('bills')}
          >
            <Ionicons name="image-outline" size={18} color={activeTab === 'bills' ? '#fff' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'bills' && styles.activeTabText]}>Bills</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Sticky Header List Container */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickyHeaderIndices={[0]}
        >
          {/* Sticky Container */}
          <View style={styles.stickyContainer}>
            {/* Filter Row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: activeTab === 'expenditures' ? 15 : 5 }}>
              <View style={styles.filterPickerContainer}>
                <Picker 
                  selectedValue={selectedMonth} 
                  onValueChange={(val) => setSelectedMonth(Number(val))} 
                  style={styles.picker}
                >
                  {MONTHS.map((m, i) => <Picker.Item key={m} label={m} value={i} color="#374151" />)}
                </Picker>
              </View>
              <View style={styles.filterPickerContainer}>
                <Picker 
                  selectedValue={selectedYear} 
                  onValueChange={(val) => setSelectedYear(Number(val))}
                  style={styles.picker}
                >
                  {YEARS.map(y => <Picker.Item key={y} label={y.toString()} value={y} color="#374151" />)}
                </Picker>
              </View>
            </View>

            {/* Summary Card */}
            {activeTab === 'expenditures' && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                  Total Expenditure ({selectedMonth === 0 ? selectedYear : `${MONTHS[selectedMonth]}/${selectedYear}`})
                </Text>
                <Text style={styles.grandTotal} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                  ₹{stats.grandTotal.toLocaleString('en-IN')}
                </Text>
                <View style={styles.splitRow}>
                  <View>
                    <Text style={styles.splitLabel}>Aadil</Text>
                    <Text style={styles.splitValue} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                      ₹{stats.aadilTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.splitDivider} />
                  <View>
                    <Text style={styles.splitLabel}>Imran</Text>
                    <Text style={styles.splitValue} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                      ₹{stats.imranTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* List Content */}
          {activeTab === 'expenditures' ? (
            stats.list.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No expenditures found</Text>
                <Text style={styles.emptySubtext}>Try changing the filter or add new entry</Text>
              </View>
            ) : (
              stats.list.map((exp) => (
                <View key={exp._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardDate}>{exp.date}</Text>
                      <Text style={styles.cardAmount}>₹{exp.amount.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.cardCategory, { flexWrap: 'wrap' }]}>
                        {exp.category} • {exp.subcategory}
                      </Text>
                      {exp.notes && (
                        <Text style={styles.cardNotes} numberOfLines={1}>{exp.notes}</Text>
                      )}
                      <Text style={styles.cardPaidBy}>Paid by {exp.paid_by}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => handleEdit(exp)} style={styles.editIconButton}>
                      <Ionicons name="create-outline" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(exp._id)} style={styles.deleteIconButton}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )
          ) : (
            filteredBills.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="image-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No bills found</Text>
                <Text style={styles.emptySubtext}>Try changing the filter or upload new bill</Text>
              </View>
            ) : (
              filteredBills.map((bill) => (
                <View key={bill._id} style={styles.billCard}>
                  <Image source={{ uri: bill.image }} style={styles.billImage} resizeMode="cover" />
                  <View style={styles.billInfo}>
                    <Text style={styles.billDescription} numberOfLines={1}>{bill.description}</Text>
                    {bill.amount && bill.amount > 0 && (
                      <Text style={styles.billAmount}>₹{bill.amount.toLocaleString('en-IN')}</Text>
                    )}
                    <Text style={styles.billDate}>{bill.date}</Text>
                    <Text style={styles.billUploader}>By {bill.uploaded_by}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity onPress={() => handleDownloadBill(bill)} style={styles.downloadIconButton}>
                      <Ionicons name="download-outline" size={18} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteBill(bill._id)} style={styles.deleteIconButton}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )
          )}
        </ScrollView>

        {/* Add/Edit Expenditure Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
              style={styles.modalContent}       // ✅ एकदम सही!
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editMode ? 'Edit Expenditure' : 'Add Expenditure'}
                </Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Paid By</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={paidBy} onValueChange={(value) => setPaidBy(value)} style={styles.picker}>
                      <Picker.Item label="Aadil" value="Aadil" color="#374151" />
                      <Picker.Item label="Imran" value="Imran" color="#374151" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pickerContainerInner}>
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
                        <Picker.Item key={cat} label={cat} value={cat} color="#374151" />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Subcategory</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={subcategory} onValueChange={(value) => setSubcategory(value as string)} style={styles.picker}>
                      {CATEGORIES[category as keyof typeof CATEGORIES]?.map((subcat) => (
                        <Picker.Item key={subcat} label={subcat} value={subcat} color="#374151" />
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
                    placeholderTextColor="#9CA3AF"
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  onPress={editMode ? handleUpdateExpenditure : handleAddExpenditure}
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>{editMode ? 'Update Expenditure' : 'Add Expenditure'}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Upload Bill Modal */}
        <Modal visible={billModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
              style={styles.modalContent}       // ✅ एकदम सही!
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Bill</Text>
                <TouchableOpacity onPress={closeBillModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
              >
                {billImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: billImage }} style={styles.imagePreview} resizeMode="cover" />
                    <TouchableOpacity onPress={() => setBillImage('')} style={styles.removeImageButton}>
                      <Ionicons name="close-circle" size={32} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerContainer}>
                    <TouchableOpacity onPress={() => pickImage(false)} style={styles.imagePickerButton} disabled={loading}>
                      <Ionicons name="images-outline" size={32} color="#10B981" />
                      <Text style={styles.imagePickerText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => pickImage(true)} style={styles.imagePickerButton} disabled={loading}>
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
                    placeholderTextColor="#9CA3AF"
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
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity onPress={() => setShowBillDatePicker(true)} style={styles.dateButton}>
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={styles.dateButtonText}>{billDate.toLocaleDateString('en-GB')}</Text>
                  </TouchableOpacity>
                  {showBillDatePicker && (
                    <DateTimePicker value={billDate} mode="date" display="default" onChange={onBillDateChange} />
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleUploadBill}
                  style={[styles.submitButton, (!billImage || loading) && styles.submitButtonDisabled]}
                  disabled={!billImage || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Upload Bill</Text>
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
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255, 255, 255, 0.95)', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 4, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 6 },
  activeTab: { backgroundColor: '#10B981' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  activeTabText: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 16 },
  stickyContainer: { backgroundColor: 'rgba(255, 255, 255, 0.92)', paddingBottom: 10, paddingTop: 8 },
  filterPickerContainer: { 
    flex: 1, backgroundColor: '#fff', borderRadius: 10, 
    minHeight: 50, /* ✅ Changed from height: 40 */
    justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' 
  },
  pickerContainerInner: { 
    backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, 
    borderColor: '#E5E7EB', overflow: 'hidden',
    minHeight: 50, /* ✅ Added minHeight */
    justifyContent: 'center'
  },
  picker: { 
    height: 50, /* ✅ Changed from 40 to 50 */
    color: '#374151' 
  },
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
  cardAmount: { fontSize: 24, fontWeight: 'bold', color: '#EF4444', marginBottom: 8 },
  cardCategory: { fontSize: 12, color: '#6B7280' },
  cardNotes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  cardPaidBy: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  editIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6' },
  deleteIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  downloadIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#10B981' },
  billCard: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  billImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 12 },
  billInfo: { flex: 1 },
  billDescription: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  billAmount: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginBottom: 2 },
  billDate: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  billUploader: { fontSize: 10, color: '#9CA3AF' },
  imagePickerContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  imagePickerButton: { flex: 1, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#10B981', borderStyle: 'dashed' },
  imagePickerText: { fontSize: 14, fontWeight: '600', color: '#10B981', marginTop: 8 },
  imagePreviewContainer: { position: 'relative', marginBottom: 16 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F3F4F6' },
  removeImageButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { 
    backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, 
    borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, 
    fontSize: 16, color: '#374151',
    minHeight: 50, /* ✅ Added minHeight */
  },
  dateButton: { 
    backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, 
    borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 50, /* ✅ Added minHeight */
  },
  dateButtonText: { fontSize: 16, color: '#1F2937' },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitButtonDisabled: { backgroundColor: '#9CA3AF' },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
