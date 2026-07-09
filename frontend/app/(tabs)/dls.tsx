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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYearForArray = new Date().getFullYear();
const YEARS = Array.from(
  { length: (currentYearForArray + 2) - 2024 + 1 }, 
  (_, i) => 2024 + i
);

const EXPENDITURE_CATEGORIES: Record<string, string[]> = {
  Feed: [
    "Cotton Khal",
    "Soybean Khal",
    "Kapila Feed",
    "Green Fodder",
    "Dry Fodder",
    "Mineral Mixture",
    "Others",
  ],
  Labour: [
    "Salary",
    "Bonus",
    "Advance",
    "Others",
  ],
  Electricity: [
    "Electric Bill",
    "Repair",
    "Others",
  ],
  Medical: [
    "Medicine",
    "Doctor",
    "Vaccination",
    "Others",
  ],
  Transport: [
    "Fuel",
    "Vehicle Repair",
    "Others",
  ],
  Miscellaneous: [
    "Others",
  ],
};

const INVESTMENT_CATEGORIES = [
  "Animal Purchase",
  "Land",
  "Construction",
  "Machinery",
  "Vehicle",
  "Equipment",
  "Others",
];

interface DLS {
  _id: string;
  month: number;
  year: number;
  amount: number;
  date: string;
  notes?: string;
}

interface Withdrawal {
  _id: string;
  amount: number;
  date: string;
  month: number;
  year: number;
  withdrawn_by: string;
  purpose: "personal" | "investment" | "expenditure";
  category?: string;
  subcategory?: string;
  notes?: string;
  linked_expenditure_id?: string;
  linked_investment_id?: string;
}

interface DashboardStats {
  total_investment: number;
  aadil_investment: number;
  imran_investment: number;
  total_earnings: number;
  total_expenditure: number;
  total_dls: number;
  available_dls: number;
  aadil_personal_withdrawal_total: number;
  imran_personal_withdrawal_total: number;
  aadil_self_funded_expenditure_total: number;
  imran_self_funded_expenditure_total: number;
  net_profit: number;
}

export default function DLSScreen() {
  const { user } = useAuth();
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [activeTab, setActiveTab] = useState<'dls' | 'withdrawals'>('dls');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [month, setMonth] = useState((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState(currentDate.getFullYear().toString());
  const [amount, setAmount] = useState('');
  
  const [date, setDate] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');

  // ==================== Withdrawal Form ====================
  const [withdrawalEditMode, setWithdrawalEditMode] = useState(false);
  const [editingWithdrawalId, setEditingWithdrawalId] = useState<string | null>(null);
  const [withdrawnBy, setWithdrawnBy] = useState("Aadil");
  const [withdrawalPurpose, setWithdrawalPurpose] = useState<
    "personal" | "investment" | "expenditure"
  >("personal");
  const [withdrawalCategory, setWithdrawalCategory] = useState("");
  const [withdrawalSubcategory, setWithdrawalSubcategory] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  const [withdrawalDate, setWithdrawalDate] = useState(new Date());
  const [showWithdrawalDatePicker, setShowWithdrawalDatePicker] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    fetchDLS();
    fetchWithdrawals();
    fetchDashboardStats();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/withdrawals`);
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data);
      }
    } catch (err) {
      console.log(err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.log(err);
    }
  };

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
    await Promise.all([
      fetchDLS(),
      fetchWithdrawals(),
      fetchDashboardStats(),
    ]);
    setRefreshing(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onWithdrawalDateChange = (
    event: any,
    selectedDate?: Date
  ) => {
    setShowWithdrawalDatePicker(
      Platform.OS === "ios"
    );
  
    if (selectedDate) {
      setWithdrawalDate(selectedDate);
    }
  };

  const filteredDLS = useMemo(() => {
    return dlsList.filter((dls) => {
      if (selectedYear === 0) return true;
      return dls.year === selectedYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dlsList, selectedYear]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals
      .filter((w) => {
        if (selectedYear === 0) return true;
        return w.year === selectedYear;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [withdrawals, selectedYear]);

  const stats = useMemo(() => {
    const totalAmount = filteredDLS.reduce((sum, dls) => sum + Number(dls.amount), 0);
    return { totalAmount };
  }, [filteredDLS]);

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
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales?user=${user?.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: parseInt(month),
          year: parseInt(year),
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Dairy Lock Sale added successfully');
        setModalVisible(false);
        resetForm();
        await Promise.all([
          fetchDLS(),
          fetchWithdrawals(),
          fetchDashboardStats(),
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add DLS');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dls: DLS) => {
    setEditMode(true);
    setEditingId(dls._id);
    setMonth(dls.month.toString());
    setYear(dls.year.toString());
    setAmount(dls.amount.toString());
    setDate(new Date(dls.date)); 
    setNotes(dls.notes || '');
    setModalVisible(true);
  };

  const handleUpdateDLS = async () => {
    if (!amount || !editingId) {
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
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales/${editingId}?user=${user?.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: parseInt(month),
          year: parseInt(year),
          amount: amt,
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'DLS updated successfully');
        setModalVisible(false);
        setEditMode(false);
        setEditingId(null);
        resetForm();
        await Promise.all([
          fetchDLS(),
          fetchWithdrawals(),
          fetchDashboardStats(),
        ]);
      } else {
        Alert.alert('Error', 'Update failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update DLS');
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
              await Promise.all([
                fetchDLS(),
                fetchWithdrawals(),
                fetchDashboardStats(),
              ]);
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to delete entry');
          }
        },
      },
    ]);
  };

  // ==================== Placeholder Backend Functions for Withdrawals ====================
  const handleAddWithdrawal = async () => {
    // TODO: Implement later
  };

  const handleUpdateWithdrawal = async () => {
    // TODO: Implement later
  };

  const handleEditWithdrawal = (withdrawal: Withdrawal) => {
    // TODO: Implement later
  };

  const handleDeleteWithdrawal = async (id: string) => {
    // TODO: Implement later
  };

  const resetForm = () => {
    const now = new Date();
    setMonth((now.getMonth() + 1).toString());
    setYear(now.getFullYear().toString());
    setAmount('');
    setDate(new Date());
    setNotes('');
  };

  const resetWithdrawalForm = () => {
    setWithdrawnBy("Aadil");
    setWithdrawalPurpose("personal");
    setWithdrawalCategory("");
    setWithdrawalSubcategory("");
    setWithdrawalAmount("");
    setWithdrawalNotes("");
    setWithdrawalDate(new Date());
    setWithdrawalEditMode(false);
    setEditingWithdrawalId(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditMode(false);
    setEditingId(null);
    resetForm();
  };

  const closeWithdrawalModal = () => {
    setWithdrawalModalVisible(false);
    resetWithdrawalForm();
  };

  const getMonthName = (monthNum: number) => MONTHS[monthNum - 1];

  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.title} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Dairy Lock Sales</Text>
            <Text style={styles.subtitle} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Actual Payments Received</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (activeTab === 'dls') {
                setModalVisible(true);
              } else {
                setWithdrawalModalVisible(true);
              }
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 12,
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            padding: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('dls')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: activeTab === 'dls' ? '#10B981' : 'transparent',
            }}
          >
            <Text style={{ textAlign: 'center', color: activeTab === 'dls' ? '#fff' : '#374151', fontWeight: '700' }}>Monthly DLS</Text>
          </TouchableOpacity>
        
          <TouchableOpacity
            onPress={() => setActiveTab('withdrawals')}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: activeTab === 'withdrawals' ? '#10B981' : 'transparent',
            }}
          >
            <Text style={{ textAlign: 'center', color: activeTab === 'withdrawals' ? '#fff' : '#374151', fontWeight: '700' }}>Withdrawals</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickyHeaderIndices={[0]} 
        >
          <View style={styles.stickyContainer}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={styles.pickerContainer}>
                <Picker 
                  selectedValue={selectedYear} 
                  onValueChange={(val) => setSelectedYear(Number(val))} 
                  style={styles.picker}
                >
                  <Picker.Item label="All Time" value={0} color="#374151" />
                  {YEARS.map(y => <Picker.Item key={y} label={`Year: ${y}`} value={y} color="#374151" />)}
                </Picker>
              </View>
            </View>

            {activeTab === "dls" && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                  {selectedYear === 0 ? "Total Received (All Time)" : `Total Received in ${selectedYear}`}
                </Text>
                <Text style={styles.grandTotal} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                  ₹{stats.totalAmount.toLocaleString("en-IN")}
                </Text>
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 14 }} />
                <Text style={{ color: "#9CA3AF", fontSize: 12 }}>Available DLS</Text>
                <Text style={{ color: "#10B981", fontSize: 22, fontWeight: "700", marginTop: 4 }}>
                  ₹{Number(dashboardStats?.available_dls ?? 0).toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>

          {activeTab === 'dls' ? (
            filteredDLS.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="lock-closed-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No payments found</Text>
                <Text style={styles.emptySubtext}>Try changing the filter or add new payment</Text>
              </View>
            ) : (
              filteredDLS.map((dls) => (
                <View key={dls._id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLeft}>
                      <View style={styles.monthBadge}>
                        <Text style={styles.monthText} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{getMonthName(dls.month)}</Text>
                        <Text style={styles.yearText} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{dls.year}</Text>
                      </View>
                    </View>
                    <View style={styles.cardCenter}>
                      <Text style={styles.cardAmount} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>₹{dls.amount.toLocaleString('en-IN')}</Text>
                      <Text style={styles.cardDate} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>Received on {dls.date}</Text>
                      {dls.notes && <Text style={styles.cardNotes} numberOfLines={2}>{dls.notes}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => handleEdit(dls)} style={styles.editIconButton}>
                        <Ionicons name="create-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(dls._id)} style={styles.deleteIconButton}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )
          ) : (
            <>
              <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 18, marginBottom: 20, elevation: 2 }}>
                <Text style={{ fontSize: 13, color: "#6B7280" }}>Available DLS</Text>
                <Text style={{ fontSize: 28, fontWeight: "bold", color: "#10B981", marginTop: 6 }}>
                  ₹{Number(dashboardStats?.available_dls ?? 0).toLocaleString("en-IN")}
                </Text>
                <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 14 }}>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>Business Expenditure</Text>
                  <Text style={{ fontWeight: "700", marginBottom: 10, color: "#10B981" }}>₹{filteredWithdrawals.filter((w) => w.purpose === "expenditure").reduce((s, w) => s + Number(w.amount), 0).toLocaleString("en-IN")}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>Business Investment</Text>
                  <Text style={{ fontWeight: "700", marginBottom: 10, color: "#3B82F6" }}>₹{filteredWithdrawals.filter((w) => w.purpose === "investment").reduce((s, w) => s + Number(w.amount), 0).toLocaleString("en-IN")}</Text>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>Personal Withdrawal</Text>
                  <Text style={{ fontWeight: "700", color: "#F59E0B" }}>₹{filteredWithdrawals.filter((w) => w.purpose === "personal").reduce((s, w) => s + Number(w.amount), 0).toLocaleString("en-IN")}</Text>
                </View>
              </View>

              {filteredWithdrawals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="cash-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No Withdrawals Found</Text>
                  <Text style={styles.emptySubtext}>Tap + to add your first withdrawal</Text>
                </View>
              ) : (
                filteredWithdrawals.map((item) => {
                  const amountColor = item.purpose === "personal" ? "#F59E0B" : item.purpose === "investment" ? "#3B82F6" : "#10B981";
                  const purposeIcon = item.purpose === "personal" ? "👤" : item.purpose === "investment" ? "📈" : "💰";
                  return (
                    <View key={item._id} style={styles.card}>
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: "700", fontSize: 16 }}>{purposeIcon} {item.purpose.charAt(0).toUpperCase() + item.purpose.slice(1)}</Text>
                          <Text style={{ color: "#6B7280", marginTop: 3 }}>{item.withdrawn_by}</Text>
                          {item.category && <Text style={{ color: "#9CA3AF", marginTop: 2 }}>{item.category}{item.subcategory ? ` / ${item.subcategory}` : ""}</Text>}
                          {item.notes && (
                            <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
                              {item.notes}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontWeight: "bold", fontSize: 20, color: amountColor }}>₹{Number(item.amount).toLocaleString("en-IN")}</Text>
                          <Text style={{ color: "#9CA3AF", marginTop: 2, fontSize: 12 }}>{item.date}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editMode ? 'Edit Payment' : 'Add Payment'}</Text>
                <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Month</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={month} onValueChange={(val) => setMonth(val)} style={styles.picker}>
                      {MONTHS.map((m, idx) => <Picker.Item key={idx} label={m} value={(idx + 1).toString()} color="#374151" />)}
                    </Picker>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Year</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker selectedValue={year} onValueChange={(val) => setYear(val)} style={styles.picker}>
                      {YEARS.map((y) => <Picker.Item key={y} label={y.toString()} value={y.toString()} color="#374151" />)}
                    </Picker>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Amount (₹)</Text>
                  <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Payment Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                    <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                    <Text style={styles.dateButtonText}>{date.toLocaleDateString('en-GB')}</Text>
                  </TouchableOpacity>
                  {showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput style={[styles.input, { minHeight: 80 }]} value={notes} onChangeText={setNotes} placeholder="Optional notes" placeholderTextColor="#9CA3AF" multiline textAlignVertical="top" />
                </View>
              </ScrollView>
              {loading ? <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 20 }} /> : 
                <TouchableOpacity onPress={editMode ? handleUpdateDLS : handleAddDLS} style={styles.submitButton}>
                  <Text style={styles.submitButtonText}>{editMode ? 'Update Payment' : 'Add Payment'}</Text>
                </TouchableOpacity>
              }
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal
          visible={withdrawalModalVisible}
          transparent
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalContent}
              keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 20}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {withdrawalEditMode ? "Edit Withdrawal" : "Add Withdrawal"}
                </Text>
                <TouchableOpacity onPress={closeWithdrawalModal}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 80 }}
              >
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Withdrawn By</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker
                      selectedValue={withdrawnBy}
                      onValueChange={(value) => setWithdrawnBy(value)}
                      style={styles.picker}
                    >
                      <Picker.Item label="Aadil" value="Aadil" />
                      <Picker.Item label="Imran" value="Imran" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Purpose</Text>
                  <View style={styles.pickerContainerInner}>
                    <Picker
                      selectedValue={withdrawalPurpose}
                      onValueChange={(value) => {
                        setWithdrawalPurpose(value);
                        setWithdrawalCategory("");
                        setWithdrawalSubcategory("");
                      }}
                      style={styles.picker}
                    >
                      <Picker.Item label="Personal" value="personal" />
                      <Picker.Item label="Business Expenditure" value="expenditure" />
                      <Picker.Item label="Business Investment" value="investment" />
                    </Picker>
                  </View>
                </View>

                {withdrawalPurpose === "expenditure" && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.pickerContainerInner}>
                      <Picker
                        selectedValue={withdrawalCategory}
                        onValueChange={(value) => {
                          setWithdrawalCategory(value);
                          setWithdrawalSubcategory("");
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select Category" value="" />
                        {Object.keys(EXPENDITURE_CATEGORIES).map((cat) => (
                          <Picker.Item key={cat} label={cat} value={cat} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {withdrawalPurpose === "expenditure" && withdrawalCategory !== "" && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Subcategory</Text>
                    <View style={styles.pickerContainerInner}>
                      <Picker
                        selectedValue={withdrawalSubcategory}
                        onValueChange={(value) => setWithdrawalSubcategory(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select Subcategory" value="" />
                        {EXPENDITURE_CATEGORIES[withdrawalCategory].map((sub) => (
                          <Picker.Item key={sub} label={sub} value={sub} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                {withdrawalPurpose === "investment" && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Investment Category</Text>
                    <View style={styles.pickerContainerInner}>
                      <Picker
                        selectedValue={withdrawalCategory}
                        onValueChange={(value) => setWithdrawalCategory(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Select Category" value="" />
                        {INVESTMENT_CATEGORIES.map((cat) => (
                          <Picker.Item key={cat} label={cat} value={cat} />
                        ))}
                      </Picker>
                    </View>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Amount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={withdrawalAmount}
                    onChangeText={setWithdrawalAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Withdrawal Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowWithdrawalDatePicker(true)}
                    style={styles.dateButton}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#6B7280"
                    />
                    <Text style={styles.dateButtonText}>
                      {withdrawalDate.toLocaleDateString("en-GB")}
                    </Text>
                  </TouchableOpacity>
                  {showWithdrawalDatePicker && (
                    <DateTimePicker
                      value={withdrawalDate}
                      mode="date"
                      display="default"
                      maximumDate={new Date()}
                      onChange={onWithdrawalDateChange}
                    />
                  )}
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        minHeight: 80,
                      },
                    ]}
                    value={withdrawalNotes}
                    onChangeText={setWithdrawalNotes}
                    placeholder="Optional notes"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

              </ScrollView>
              
              {loading ? (
                <ActivityIndicator
                  size="large"
                  color="#10B981"
                  style={{ marginTop: 20 }}
                />
              ) : (
                <TouchableOpacity
                  onPress={
                    withdrawalEditMode
                      ? handleUpdateWithdrawal
                      : handleAddWithdrawal
                  }
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>
                    {withdrawalEditMode
                      ? "Update Withdrawal"
                      : "Add Withdrawal"}
                  </Text>
                </TouchableOpacity>
              )}

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
  title: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  subtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  addButton: { backgroundColor: '#10B981', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 16 },
  stickyContainer: { backgroundColor: 'rgba(255, 255, 255, 0.92)', paddingBottom: 10, paddingTop: 8 },
  pickerContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 10, minHeight: 50, justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  pickerContainerInner: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', minHeight: 50, justifyContent: 'center' },
  picker: { height: 55, color: '#374151' },
  summaryCard: { backgroundColor: '#1F2937', borderRadius: 15, padding: 20 },
  summaryLabel: { color: '#9CA3AF', fontSize: 12 },
  grandTotal: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, padding: 14, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLeft: { marginRight: 12 },
  monthBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center', minWidth: 70 },
  monthText: { fontSize: 11, fontWeight: '600', color: '#059669' },
  yearText: { fontSize: 15, fontWeight: 'bold', color: '#10B981', marginTop: 2 },
  cardCenter: { flex: 1 },
  cardAmount: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  cardDate: { fontSize: 11, color: '#6B7280' },
  cardNotes: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  editIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#3B82F6' },
  deleteIconButton: { padding: 8, backgroundColor: 'transparent', borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, fontSize: 16, color: '#374151', minHeight: 50 },
  dateButton: { backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 50 },
  dateButtonText: { fontSize: 15, color: '#1F2937' },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
