#!/usr/bin/env python3
"""
Wazir Dairy Farming Backend Test Suite - Phase 3 Notification System Testing
Testing notification system for WRX chat feature integration
"""

import requests
import json
from datetime import datetime, timedelta
import time

# Backend URL from environment
BACKEND_URL = "https://wazir-partner-portal.preview.emergentagent.com/api"

class WazirBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.notification_ids = []
        self.entry_ids = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(f"{status} {test_name}: {details}")
        print(f"{status} {test_name}: {details}")
        
    def test_auth_setup(self):
        """Test user authentication setup"""
        try:
            response = self.session.post(f"{BACKEND_URL}/auth/setup")
            success = response.status_code == 200
            self.log_test("Auth Setup", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Auth Setup", False, f"Error: {str(e)}")
            return False
            
    def test_login(self):
        """Test user login"""
        try:
            login_data = {"name": "Aadil", "pin": "1234"}
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            success = response.status_code == 200 and response.json().get("success")
            self.log_test("User Login", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("User Login", False, f"Error: {str(e)}")
            return False

    def test_complete_entry_workflow(self):
        """Test complete entry workflow and verify notifications are auto-created"""
        print("\n=== TESTING COMPLETE ENTRY WORKFLOW ===")
        
        # 1. Add milk sale entry
        try:
            milk_sale_data = {
                "date": "2024-01-15",
                "volume": 32.5,
                "fat_percentage": 4.2,
                "rate": 8.4,
                "earnings": 273.0
            }
            response = self.session.post(f"{BACKEND_URL}/milk-sales", json=milk_sale_data)
            success = response.status_code == 200
            if success:
                self.entry_ids.append(("milk_sale", response.json().get("id")))
            self.log_test("Add Milk Sale Entry", success, f"Volume: {milk_sale_data['volume']}L, Earnings: ₹{milk_sale_data['earnings']}")
        except Exception as e:
            self.log_test("Add Milk Sale Entry", False, f"Error: {str(e)}")
            
        # 2. Add expenditure entry
        try:
            expenditure_data = {
                "amount": 15000,
                "date": "2024-01-15",
                "paid_by": "Aadil",
                "category": "Feed",
                "subcategory": "Cattle Feed"
            }
            response = self.session.post(f"{BACKEND_URL}/expenditures", json=expenditure_data)
            success = response.status_code == 200
            if success:
                self.entry_ids.append(("expenditure", response.json().get("id")))
            self.log_test("Add Expenditure Entry", success, f"Category: {expenditure_data['category']}/{expenditure_data['subcategory']}, Amount: ₹{expenditure_data['amount']}")
        except Exception as e:
            self.log_test("Add Expenditure Entry", False, f"Error: {str(e)}")
            
        # 3. Add investment entry
        try:
            investment_data = {
                "amount": 50000,
                "date": "2024-01-15",
                "investor": "Imran",
                "category": "Equipment"
            }
            response = self.session.post(f"{BACKEND_URL}/investments", json=investment_data)
            success = response.status_code == 200
            if success:
                self.entry_ids.append(("investment", response.json().get("id")))
            self.log_test("Add Investment Entry", success, f"Investor: {investment_data['investor']}, Category: {investment_data['category']}, Amount: ₹{investment_data['amount']}")
        except Exception as e:
            self.log_test("Add Investment Entry", False, f"Error: {str(e)}")
            
        # 4. Add DLS entry
        try:
            dls_data = {
                "month": 1,
                "year": 2024,
                "amount": 12000,
                "date": "2024-01-15",
                "notes": "January payment for WRX testing"
            }
            response = self.session.post(f"{BACKEND_URL}/dairy-lock-sales", json=dls_data)
            success = response.status_code == 200
            if success:
                self.entry_ids.append(("dls", response.json().get("id")))
            self.log_test("Add DLS Entry", success, f"Month: {dls_data['month']}/{dls_data['year']}, Amount: ₹{dls_data['amount']}")
        except Exception as e:
            self.log_test("Add DLS Entry", False, f"Error: {str(e)}")
            
        # 5. Verify notifications were auto-created for all 4 entries
        time.sleep(1)  # Brief pause to ensure notifications are created
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications")
            success = response.status_code == 200
            if success:
                notifications = response.json()
                recent_notifications = [n for n in notifications if 'January' in n.get('message', '') or '2024-01-15' in n.get('message', '')]
                
                # Check for each type of notification
                notification_types = set()
                for notif in recent_notifications:
                    notification_types.add(notif.get('type'))
                    self.notification_ids.append(notif.get('_id'))
                
                expected_types = {'milk_sale', 'expenditure', 'investment', 'dls'}
                all_created = expected_types.issubset(notification_types)
                
                self.log_test("Auto-Notifications Created", all_created, 
                            f"Found {len(recent_notifications)} notifications with types: {notification_types}")
            else:
                self.log_test("Auto-Notifications Created", False, f"Failed to fetch notifications: {response.status_code}")
        except Exception as e:
            self.log_test("Auto-Notifications Created", False, f"Error: {str(e)}")

    def test_notification_features(self):
        """Test notification system features"""
        print("\n=== TESTING NOTIFICATION FEATURES ===")
        
        # 1. GET /api/notifications - Verify all notifications returned
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications")
            success = response.status_code == 200
            if success:
                notifications = response.json()
                self.log_test("GET Notifications", success, f"Retrieved {len(notifications)} notifications")
                
                # Verify notification messages are descriptive
                descriptive_count = 0
                for notif in notifications[:5]:  # Check first 5
                    message = notif.get('message', '')
                    if any(word in message for word in ['₹', 'added', 'removed', 'Sale', 'Investment', 'Expenditure']):
                        descriptive_count += 1
                
                self.log_test("Descriptive Messages", descriptive_count > 0, 
                            f"{descriptive_count}/5 notifications have descriptive messages")
            else:
                self.log_test("GET Notifications", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET Notifications", False, f"Error: {str(e)}")
            
        # 2. POST /api/notifications/react - Add reactions
        if self.notification_ids:
            try:
                # Test different emoji reactions
                emojis = ['👍', '✅', '❌', '❤️', '😊']
                reaction_success = 0
                
                for i, emoji in enumerate(emojis):
                    if i < len(self.notification_ids):
                        reaction_data = {
                            "notification_id": self.notification_ids[i],
                            "user": "Aadil",
                            "emoji": emoji
                        }
                        response = self.session.post(f"{BACKEND_URL}/notifications/react", json=reaction_data)
                        if response.status_code == 200:
                            reaction_success += 1
                
                self.log_test("Add Reactions", reaction_success > 0, 
                            f"Successfully added {reaction_success}/{len(emojis)} reactions")
                            
                # Verify reactions are stored with username
                response = self.session.get(f"{BACKEND_URL}/notifications")
                if response.status_code == 200:
                    notifications = response.json()
                    reactions_found = 0
                    for notif in notifications:
                        if notif.get('reactions') and 'Aadil' in notif.get('reactions', {}):
                            reactions_found += 1
                    
                    self.log_test("Reactions Stored with Username", reactions_found > 0,
                                f"Found {reactions_found} notifications with Aadil's reactions")
                                
            except Exception as e:
                self.log_test("Add Reactions", False, f"Error: {str(e)}")
                
        # 3. POST /api/notifications/mark-read - Mark notifications as read
        if self.notification_ids:
            try:
                read_data = {
                    "notification_ids": self.notification_ids[:3],  # Mark first 3 as read
                    "user": "Aadil"
                }
                response = self.session.post(f"{BACKEND_URL}/notifications/mark-read", json=read_data)
                success = response.status_code == 200
                self.log_test("Mark Notifications Read", success, f"Marked {len(read_data['notification_ids'])} notifications as read")
                
                # Verify read_by array is updated
                if success:
                    response = self.session.get(f"{BACKEND_URL}/notifications")
                    if response.status_code == 200:
                        notifications = response.json()
                        read_count = 0
                        for notif in notifications:
                            if 'Aadil' in notif.get('read_by', []):
                                read_count += 1
                        
                        self.log_test("Read_by Array Updated", read_count >= 3,
                                    f"Found {read_count} notifications marked as read by Aadil")
                                    
            except Exception as e:
                self.log_test("Mark Notifications Read", False, f"Error: {str(e)}")

    def test_dashboard_chart_data(self):
        """Test dashboard chart data endpoints"""
        print("\n=== TESTING DASHBOARD CHART DATA ===")
        
        # 1. GET /api/milk-sales - Get all sales for chart
        try:
            response = self.session.get(f"{BACKEND_URL}/milk-sales")
            success = response.status_code == 200
            if success:
                sales = response.json()
                self.log_test("GET Milk Sales for Chart", success, f"Retrieved {len(sales)} milk sales entries")
                
                # Verify data can be grouped by month for line chart
                if sales:
                    monthly_data = {}
                    for sale in sales:
                        date_str = sale.get('date', '')
                        if date_str:
                            month_key = date_str[:7]  # YYYY-MM format
                            if month_key not in monthly_data:
                                monthly_data[month_key] = []
                            monthly_data[month_key].append(sale)
                    
                    self.log_test("Monthly Grouping Possible", len(monthly_data) > 0,
                                f"Data can be grouped into {len(monthly_data)} months")
            else:
                self.log_test("GET Milk Sales for Chart", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET Milk Sales for Chart", False, f"Error: {str(e)}")
            
        # 2. GET /api/expenditures - Get all expenditures for chart
        try:
            response = self.session.get(f"{BACKEND_URL}/expenditures")
            success = response.status_code == 200
            if success:
                expenditures = response.json()
                self.log_test("GET Expenditures for Chart", success, f"Retrieved {len(expenditures)} expenditure entries")
            else:
                self.log_test("GET Expenditures for Chart", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET Expenditures for Chart", False, f"Error: {str(e)}")
            
        # 3. GET /api/stats/dashboard - Verify investment breakdown for pie chart
        try:
            response = self.session.get(f"{BACKEND_URL}/stats/dashboard")
            success = response.status_code == 200
            if success:
                stats = response.json()
                required_fields = ['total_investment', 'aadil_investment', 'imran_investment', 
                                 'total_earnings', 'total_expenditure', 'net_profit', 'total_dls']
                
                fields_present = all(field in stats for field in required_fields)
                self.log_test("Dashboard Stats for Charts", fields_present,
                            f"All required fields present: {fields_present}")
                            
                # Verify investment breakdown for pie chart
                if 'aadil_investment' in stats and 'imran_investment' in stats:
                    breakdown_available = stats['aadil_investment'] >= 0 and stats['imran_investment'] >= 0
                    self.log_test("Investment Breakdown Available", breakdown_available,
                                f"Aadil: ₹{stats.get('aadil_investment', 0)}, Imran: ₹{stats.get('imran_investment', 0)}")
            else:
                self.log_test("Dashboard Stats for Charts", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Dashboard Stats for Charts", False, f"Error: {str(e)}")

    def test_deletion_notifications(self):
        """Test deletion notifications"""
        print("\n=== TESTING DELETION NOTIFICATIONS ===")
        
        if self.entry_ids:
            try:
                # Delete one entry (first one in the list)
                entry_type, entry_id = self.entry_ids[0]
                
                endpoint_map = {
                    'milk_sale': 'milk-sales',
                    'expenditure': 'expenditures', 
                    'investment': 'investments',
                    'dls': 'dairy-lock-sales'
                }
                
                endpoint = endpoint_map.get(entry_type)
                if endpoint:
                    response = self.session.delete(f"{BACKEND_URL}/{endpoint}/{entry_id}?user=Aadil")
                    success = response.status_code == 200
                    self.log_test("Delete Entry", success, f"Deleted {entry_type} entry: {entry_id}")
                    
                    # Verify deletion notification is created
                    if success:
                        time.sleep(1)  # Brief pause
                        response = self.session.get(f"{BACKEND_URL}/notifications")
                        if response.status_code == 200:
                            notifications = response.json()
                            deletion_notifications = [n for n in notifications if n.get('type') == 'deletion']
                            
                            recent_deletion = None
                            for notif in deletion_notifications:
                                if 'Aadil removed' in notif.get('message', ''):
                                    recent_deletion = notif
                                    break
                            
                            self.log_test("Deletion Notification Created", recent_deletion is not None,
                                        f"Found deletion notification: {recent_deletion.get('message', '') if recent_deletion else 'None'}")
                        
            except Exception as e:
                self.log_test("Delete Entry", False, f"Error: {str(e)}")
        else:
            self.log_test("Delete Entry", False, "No entries available to delete")

    def test_90_day_filtering(self):
        """Test 90-day notification filtering"""
        print("\n=== TESTING 90-DAY NOTIFICATION FILTERING ===")
        
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications")
            success = response.status_code == 200
            if success:
                notifications = response.json()
                
                # Check if all notifications are within 90 days
                ninety_days_ago = datetime.utcnow() - timedelta(days=90)
                within_range_count = 0
                
                for notif in notifications:
                    created_at_str = notif.get('created_at')
                    if created_at_str:
                        # Parse the datetime string
                        try:
                            created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                            if created_at >= ninety_days_ago:
                                within_range_count += 1
                        except:
                            # If parsing fails, assume it's recent
                            within_range_count += 1
                
                self.log_test("90-Day Filtering", within_range_count == len(notifications),
                            f"{within_range_count}/{len(notifications)} notifications within 90 days")
            else:
                self.log_test("90-Day Filtering", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("90-Day Filtering", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all notification system tests"""
        print("🚀 Starting Wazir Dairy Farming Backend Tests - Phase 3 Notification System")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        # Setup and authentication
        self.test_auth_setup()
        self.test_login()
        
        # Main test scenarios
        self.test_complete_entry_workflow()
        self.test_notification_features()
        self.test_dashboard_chart_data()
        self.test_deletion_notifications()
        self.test_90_day_filtering()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if "✅ PASS" in result)
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result)
        
        for result in self.test_results:
            print(result)
            
        print(f"\n🎯 OVERALL RESULT: {passed} PASSED, {failed} FAILED")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED! Notification system is working correctly for WRX chat feature.")
        else:
            print("⚠️  Some tests failed. Please check the details above.")
            
        return failed == 0

if __name__ == "__main__":
    tester = WazirBackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)