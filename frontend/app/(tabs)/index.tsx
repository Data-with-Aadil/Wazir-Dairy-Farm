import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { useAuth } from '../../context/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

const BACKGROUND_IMAGE = 'https://customer-assets.emergentagent.com/job_2ded3f0f-8937-48e9-9afe-e862fe69dea1/artifacts/0vjmy7gj_1000044672.jpg';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DashboardStats {
  total_investment: number;
  aadil_investment: number;
  imran_investment: number;
  total_earnings: number;
  total_expenditure: number;
  net_profit: number;
  total_dls: number;
}

interface MilkSale {
  date: string;
  earnings: number;
}

interface Expenditure {
  date: string;
  amount: number;
}

interface DLS {
  date: string;
  amount: number;
  month: number;
  year: number;
}

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [milkSales, setMilkSales] = useState<MilkSale[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [dlsList, setDlsList] = useState<DLS[]>([]);
  const [currentMonthDLS, setCurrentMonthDLS] = useState(0);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = React.useRef(null);

  // Auto-refresh when tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      fetchStats();
      fetchChartData();
      fetchDLS();
    }, [])
  );

  useEffect(() => {
    setupUsers();
  }, []);

  const setupUsers = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/setup`, { method: 'POST' });
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchChartData = async () => {
    try {
      const [salesRes, expendRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/milk-sales`),
        fetch(`${BACKEND_URL}/api/expenditures`),
      ]);

      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setMilkSales(salesData);
      }

      if (expendRes.ok) {
        const expendData = await expendRes.json();
        setExpenditures(expendData);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const fetchDLS = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dairy-lock-sales`);
      if (response.ok) {
        const data = await response.json();
        setDlsList(data);

        // Calculate current month DLS
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        const currentMonthTotal = data
          .filter((dls: DLS) => dls.month === currentMonth && dls.year === currentYear)
          .reduce((sum: number, dls: DLS) => sum + dls.amount, 0);
        
        setCurrentMonthDLS(currentMonthTotal);
      }
    } catch (error) {
      console.error('Error fetching DLS:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchChartData(), fetchDLS()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; }
              h1 { color: #10B981; text-align: center; }
              .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
              .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; }
              .metric { display: flex; justify-content: space-between; margin: 8px 0; }
              .label { color: #666; }
              .value { font-weight: bold; color: #333; }
              .green { color: #10B981; }
              .red { color: #EF4444; }
              .blue { color: #3B82F6; }
            </style>
          </head>
          <body>
            <h1>Wazir Dairy Farming - Dashboard Report</h1>
            <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
            
            <div class="section">
              <div class="section-title">Total Investment</div>
              <div class="metric">
                <span class="label">Total:</span>
                <span class="value green">₹${stats?.total_investment.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div class="metric">
                <span class="label">Aadil:</span>
                <span class="value">₹${stats?.aadil_investment.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div class="metric">
                <span class="label">Imran:</span>
                <span class="value">₹${stats?.imran_investment.toLocaleString('en-IN') || '0'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Monthly Performance</div>
              <div class="metric">
                <span class="label">Earnings:</span>
                <span class="value green">₹${stats?.total_earnings.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div class="metric">
                <span class="label">Expenditure:</span>
                <span class="value red">₹${stats?.total_expenditure.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div class="metric">
                <span class="label">Net Profit:</span>
                <span class="value ${(stats?.net_profit || 0) >= 0 ? 'green' : 'red'}">₹${stats?.net_profit.toLocaleString('en-IN') || '0'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Dairy Lock Sales</div>
              <div class="metric">
                <span class="label">Total:</span>
                <span class="value">₹${stats?.total_dls.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div class="metric">
                <span class="label">Current Month:</span>
                <span class="value blue">₹${currentMonthDLS.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <p style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
              Wazir Dairy Farming © 2026
            </p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      Alert.alert(
        'PDF Generated',
        'Dashboard report has been created. Would you like to share it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  // Prepare line chart data
  const getLineChartData = () => {
    const monthlyData: { [key: string]: { earnings: number; expenditure: number } } = {};

    milkSales.forEach((sale) => {
      const month = sale.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { earnings: 0, expenditure: 0 };
      }
      monthlyData[month].earnings += sale.earnings;
    });

    expenditures.forEach((exp) => {
      const month = exp.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { earnings: 0, expenditure: 0 };
      }
      monthlyData[month].expenditure += exp.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const recent = sortedMonths.slice(-6);

    const earningsData = recent.map((month) => ({
      value: monthlyData[month].earnings / 1000,
      label: month.substring(5),
      dataPointText: `${(monthlyData[month].earnings / 1000).toFixed(1)}k`,
    }));

    const expenditureData = recent.map((month) => ({
      value: monthlyData[month].expenditure / 1000,
    }));

    return { earningsData, expenditureData };
  };

  const getPieChartData = () => {
    if (!stats || stats.total_investment === 0) return [];

    return [
      {
        value: stats.aadil_investment,
        color: '#10B981',
        text: `${((stats.aadil_investment / stats.total_investment) * 100).toFixed(0)}%`,
        label: 'Aadil',
      },
      {
        value: stats.imran_investment,
        color: '#3B82F6',
        text: `${((stats.imran_investment / stats.total_investment) * 100).toFixed(0)}%`,
        label: 'Imran',
      },
    ];
  };

  const { earningsData, expenditureData } = getLineChartData();
  const pieData = getPieChartData();

  return (
    <ImageBackground
      source={{ uri: BACKGROUND_IMAGE }}
      style={styles.background}
      blurRadius={50}
    >
      <View style={styles.overlay}>
        <ScrollView
          ref={dashboardRef}
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={exportToPDF}
                style={styles.exportButton}
                disabled={exporting}
              >
                <Ionicons name="download-outline" size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Investment Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Investment</Text>
            <Text style={styles.mainValue}>₹{stats?.total_investment.toLocaleString('en-IN') || '0'}</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Aadil</Text>
                <Text style={styles.statValue}>₹{stats?.aadil_investment.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Imran</Text>
                <Text style={styles.statValue}>₹{stats?.imran_investment.toLocaleString('en-IN') || '0'}</Text>
              </View>
            </View>
          </View>

          {/* Monthly Performance Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Performance</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Ionicons name="trending-up" size={20} color="#10B981" />
                <Text style={styles.metricLabel}>Earnings</Text>
                <Text style={styles.metricValue}>₹{stats?.total_earnings.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="trending-down" size={20} color="#EF4444" />
                <Text style={styles.metricLabel}>Expenditure</Text>
                <Text style={styles.metricValue}>₹{stats?.total_expenditure.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="cash" size={20} color="#3B82F6" />
                <Text style={styles.metricLabel}>Net Profit</Text>
                <Text style={[styles.metricValue, { color: (stats?.net_profit || 0) >= 0 ? '#10B981' : '#EF4444' }]}>
                  ₹{stats?.net_profit.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dairy Lock Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dairy Lock Sales</Text>
            <View style={styles.dlsContainer}>
              <View style={styles.dlsItem}>
                <Text style={styles.dlsLabel}>Total</Text>
                <Text style={styles.mainValue}>₹{stats?.total_dls.toLocaleString('en-IN') || '0'}</Text>
              </View>
              <View style={styles.dlsDivider} />
              <View style={styles.dlsItem}>
                <Text style={styles.dlsLabel}>This Month</Text>
                <Text style={styles.dlsMonthValue}>₹{currentMonthDLS.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </View>

          {/* Charts */}
          {earningsData.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Earnings vs Expenditure (Last 6 Months)</Text>
              <View style={styles.chartContainer}>
                <LineChart
                  data={earningsData}
                  data2={expenditureData}
                  height={200}
                  width={screenWidth - 80}
                  spacing={50}
                  initialSpacing={10}
                  color1="#10B981"
                  color2="#EF4444"
                  textColor1="#10B981"
                  dataPointsHeight={6}
                  dataPointsWidth={6}
                  dataPointsColor1="#10B981"
                  dataPointsColor2="#EF4444"
                  textShiftY={-8}
                  textShiftX={-5}
                  textFontSize={10}
                  thickness={3}
                  hideRules
                  yAxisColor="#E5E7EB"
                  xAxisColor="#E5E7EB"
                  yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#6B7280', fontSize: 10 }}
                  curved
                />
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendText}>Earnings</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.legendText}>Expenditure</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {stats && stats.total_investment > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Investment Distribution</Text>
              <View style={styles.pieChartContainer}>
                <PieChart
                  data={pieData}
                  radius={80}
                  innerRadius={40}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1F2937' }}>Total</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        ₹{(stats.total_investment / 1000).toFixed(0)}k
                      </Text>
                    </View>
                  )}
                />
                <View style={styles.pieLegend}>
                  <View style={styles.pieLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <View>
                      <Text style={styles.pieLegendLabel}>Aadil</Text>
                      <Text style={styles.pieLegendValue}>₹{stats.aadil_investment.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                  <View style={styles.pieLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                    <View>
                      <Text style={styles.pieLegendLabel}>Imran</Text>
                      <Text style={styles.pieLegendValue}>₹{stats.imran_investment.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButton: {
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
  },
  logoutButton: {
    padding: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  mainValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dlsItem: {
    flex: 1,
    alignItems: 'center',
  },
  dlsDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  dlsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  dlsMonthValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  chartContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  pieChartContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  pieLegend: {
    marginTop: 24,
    gap: 12,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pieLegendLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  pieLegendValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});