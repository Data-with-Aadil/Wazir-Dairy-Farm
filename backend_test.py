#!/usr/bin/env python3
"""
Comprehensive End-to-End Testing for Wazir Dairy Farming App
Testing complete user journey after all fixes with clean data
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Backend URL from environment
BACKEND_URL = "https://wazir-partner-portal.preview.emergentagent.com/api"

class WazirDairyTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_ids = {
            'investments': [],
            'expenditures': [],
            'milk_sales': [],
            'dairy_lock_sales': [],
            'notifications': []
        }
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and isinstance(response_data, dict):
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'response': response_data
        })
        
    def make_request(self, method, endpoint, data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url, params=params)
            elif method == "POST":
                response = self.session.post(url, json=data)
            elif method == "DELETE":
                response = self.session.delete(url, params=params)
            
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}")
                print(f"Response text: {e.response.text}")
            return None

    def test_1_verify_clean_state(self):
        """Test 1: Verify Clean State - all endpoints should return empty/zero data"""
        print("=== TEST 1: VERIFY CLEAN STATE ===")
        
        # Test dashboard stats - should show all zeros
        stats = self.make_request("GET", "/stats/dashboard")
        if stats:
            expected_zeros = ['total_investment', 'aadil_investment', 'imran_investment', 
                            'total_earnings', 'total_expenditure', 'total_dls']
            all_zero = all(stats.get(key, -1) == 0 for key in expected_zeros)
            net_profit_zero = stats.get('net_profit', -1) == 0
            
            self.log_test("Dashboard Stats - All Zeros", 
                         all_zero and net_profit_zero,
                         f"Stats: {stats}", stats)
        else:
            self.log_test("Dashboard Stats - All Zeros", False, "Failed to get dashboard stats")
        
        # Test all data endpoints - should return empty arrays
        endpoints = [
            ("/investments", "Investments"),
            ("/expenditures", "Expenditures"), 
            ("/milk-sales", "Milk Sales"),
            ("/dairy-lock-sales", "Dairy Lock Sales"),
            ("/notifications", "Notifications")
        ]
        
        for endpoint, name in endpoints:
            data = self.make_request("GET", endpoint)
            if data is not None:
                is_empty = len(data) == 0
                self.log_test(f"{name} - Empty Array", is_empty, 
                             f"Count: {len(data)}", {"count": len(data)})
            else:
                self.log_test(f"{name} - Empty Array", False, "Failed to get data")

    def test_2_user_authentication(self):
        """Test 2: User Authentication"""
        print("=== TEST 2: USER AUTHENTICATION ===")
        
        # Test valid login for Aadil
        login_data = {"name": "Aadil", "pin": "1234"}
        response = self.make_request("POST", "/auth/login", login_data)
        if response:
            success = response.get('success') == True
            user_name = response.get('user', {}).get('name') == 'Aadil'
            self.log_test("Login as Aadil (PIN: 1234)", 
                         success and user_name,
                         f"User: {response.get('user', {})}", response)
        else:
            self.log_test("Login as Aadil (PIN: 1234)", False, "Login request failed")
        
        # Test invalid login
        invalid_login = {"name": "Aadil", "pin": "9999"}
        response = self.make_request("POST", "/auth/login", invalid_login)
        # Should fail with 401
        self.log_test("Invalid Login (Wrong PIN)", 
                     response is None,
                     "Should return 401 error")

    def test_3_complete_user_journey(self):
        """Test 3: Complete User Journey - Add entries and verify notifications"""
        print("=== TEST 3: COMPLETE USER JOURNEY ===")
        
        # Add 2 investments (one for Aadil, one for Imran)
        investments = [
            {
                "amount": 75000,
                "date": "2026-03-15",
                "investor": "Aadil", 
                "category": "Cattle Purchase"
            },
            {
                "amount": 50000,
                "date": "2026-03-10",
                "investor": "Imran",
                "category": "Infrastructure"
            }
        ]
        
        for i, inv in enumerate(investments):
            response = self.make_request("POST", "/investments", inv)
            if response and response.get('success'):
                self.created_ids['investments'].append(response.get('id'))
                self.log_test(f"Investment {i+1} - {inv['investor']} ₹{inv['amount']:,}", 
                             True, f"ID: {response.get('id')}", response)
            else:
                self.log_test(f"Investment {i+1} - {inv['investor']} ₹{inv['amount']:,}", 
                             False, "Failed to create investment")
        
        # Add 2 expenditures (different categories)
        expenditures = [
            {
                "amount": 12500,
                "date": "2026-03-14",
                "paid_by": "Aadil",
                "category": "Supplements",
                "subcategory": "Mineral Mix"
            },
            {
                "amount": 30000,
                "date": "2026-03-12",
                "paid_by": "Imran", 
                "category": "Fodder",
                "subcategory": "Green Fodder"
            }
        ]
        
        for i, exp in enumerate(expenditures):
            response = self.make_request("POST", "/expenditures", exp)
            if response and response.get('success'):
                self.created_ids['expenditures'].append(response.get('id'))
                self.log_test(f"Expenditure {i+1} - {exp['category']}/{exp['subcategory']} ₹{exp['amount']:,}", 
                             True, f"ID: {response.get('id')}", response)
            else:
                self.log_test(f"Expenditure {i+1} - {exp['category']}/{exp['subcategory']} ₹{exp['amount']:,}", 
                             False, "Failed to create expenditure")
        
        # Add 2 milk sales (different dates)
        milk_sales = [
            {
                "date": "2026-03-15",
                "volume": 28.5,
                "fat_percentage": 4.1,
                "rate": 8.4,
                "earnings": 28.5 * 8.4  # 239.4
            },
            {
                "date": "2026-03-14", 
                "volume": 32.0,
                "fat_percentage": 3.9,
                "rate": 8.2,
                "earnings": 32.0 * 8.2  # 262.4
            }
        ]
        
        for i, sale in enumerate(milk_sales):
            response = self.make_request("POST", "/milk-sales", sale)
            if response and response.get('success'):
                self.created_ids['milk_sales'].append(response.get('id'))
                self.log_test(f"Milk Sale {i+1} - {sale['volume']}L at {sale['fat_percentage']}% = ₹{sale['earnings']}", 
                             True, f"ID: {response.get('id')}", response)
            else:
                self.log_test(f"Milk Sale {i+1} - {sale['volume']}L at {sale['fat_percentage']}% = ₹{sale['earnings']}", 
                             False, "Failed to create milk sale")
        
        # Add 1 DLS entry for current month (March 2026)
        dls_entry = {
            "month": 3,
            "year": 2026,
            "amount": 15000,
            "date": "2026-03-15",
            "notes": "March 2026 DLS payment"
        }
        
        response = self.make_request("POST", "/dairy-lock-sales", dls_entry)
        if response and response.get('success'):
            self.created_ids['dairy_lock_sales'].append(response.get('id'))
            self.log_test("DLS Entry - March 2026 ₹15,000", 
                         True, f"ID: {response.get('id')}", response)
        else:
            self.log_test("DLS Entry - March 2026 ₹15,000", 
                         False, "Failed to create DLS entry")

    def test_4_dashboard_calculations(self):
        """Test 4: Verify Dashboard Stats Calculate Correctly"""
        print("=== TEST 4: DASHBOARD CALCULATIONS ===")
        
        stats = self.make_request("GET", "/stats/dashboard")
        if stats:
            # Expected calculations:
            # Total Investment: 75000 + 50000 = 125000
            # Aadil Investment: 75000
            # Imran Investment: 50000  
            # Total Earnings: 239.4 + 262.4 = 501.8
            # Total Expenditure: 12500 + 30000 = 42500
            # Net Profit: 501.8 - 42500 = -41998.2
            # Total DLS: 15000
            
            expected = {
                'total_investment': 125000,
                'aadil_investment': 75000,
                'imran_investment': 50000,
                'total_earnings': 501.8,
                'total_expenditure': 42500,
                'net_profit': -41998.2,
                'total_dls': 15000
            }
            
            all_correct = True
            for key, expected_val in expected.items():
                actual_val = stats.get(key, 0)
                if abs(actual_val - expected_val) > 0.1:  # Allow small floating point differences
                    all_correct = False
                    print(f"   ❌ {key}: Expected {expected_val}, Got {actual_val}")
                else:
                    print(f"   ✅ {key}: {actual_val}")
            
            self.log_test("Dashboard Calculations Correct", all_correct, 
                         f"Expected: {expected}, Actual: {stats}", stats)
        else:
            self.log_test("Dashboard Calculations Correct", False, "Failed to get dashboard stats")

    def test_5_notifications_created(self):
        """Test 5: Verify Notifications Created for All 7 Entries"""
        print("=== TEST 5: NOTIFICATIONS VERIFICATION ===")
        
        notifications = self.make_request("GET", "/notifications")
        if notifications:
            # Should have 7 notifications: 2 investments + 2 expenditures + 2 milk sales + 1 DLS
            expected_count = 7
            actual_count = len(notifications)
            
            self.log_test(f"Notification Count ({expected_count} expected)", 
                         actual_count == expected_count,
                         f"Expected: {expected_count}, Actual: {actual_count}")
            
            # Check notification types
            types = [notif.get('type') for notif in notifications]
            expected_types = ['investment', 'investment', 'expenditure', 'expenditure', 
                            'milk_sale', 'milk_sale', 'dls']
            
            # Count each type
            type_counts = {}
            for t in types:
                type_counts[t] = type_counts.get(t, 0) + 1
            
            expected_type_counts = {'investment': 2, 'expenditure': 2, 'milk_sale': 2, 'dls': 1}
            types_correct = type_counts == expected_type_counts
            
            self.log_test("Notification Types Correct", types_correct,
                         f"Expected: {expected_type_counts}, Actual: {type_counts}")
            
            # Verify messages are descriptive
            messages_descriptive = all(len(notif.get('message', '')) > 20 for notif in notifications)
            self.log_test("Notification Messages Descriptive", messages_descriptive,
                         f"All messages > 20 chars: {messages_descriptive}")
            
        else:
            self.log_test("Notifications Retrieved", False, "Failed to get notifications")

    def test_6_current_month_dls(self):
        """Test 6: Test Current Month DLS Calculation"""
        print("=== TEST 6: CURRENT MONTH DLS CALCULATION ===")
        
        # Add DLS for previous month (February 2026)
        feb_dls = {
            "month": 2,
            "year": 2026,
            "amount": 12000,
            "date": "2026-02-28",
            "notes": "February 2026 DLS payment"
        }
        
        response = self.make_request("POST", "/dairy-lock-sales", feb_dls)
        if response and response.get('success'):
            self.created_ids['dairy_lock_sales'].append(response.get('id'))
            self.log_test("DLS Entry - February 2026 ₹12,000", True, f"ID: {response.get('id')}")
        else:
            self.log_test("DLS Entry - February 2026 ₹12,000", False, "Failed to create Feb DLS")
        
        # Verify dashboard shows total DLS (both months)
        stats = self.make_request("GET", "/stats/dashboard")
        if stats:
            # Total DLS should now be: 15000 (March) + 12000 (February) = 27000
            expected_total_dls = 27000
            actual_total_dls = stats.get('total_dls', 0)
            
            self.log_test("Total DLS Calculation (Both Months)", 
                         actual_total_dls == expected_total_dls,
                         f"Expected: {expected_total_dls}, Actual: {actual_total_dls}")
        else:
            self.log_test("Total DLS Calculation", False, "Failed to get dashboard stats")

    def test_7_delete_operations(self):
        """Test 7: Test Delete Operations and Soft Delete"""
        print("=== TEST 7: DELETE OPERATIONS ===")
        
        # Delete one investment (if we have any)
        if self.created_ids['investments']:
            inv_id = self.created_ids['investments'][0]
            response = self.make_request("DELETE", f"/investments/{inv_id}", params={"user": "Aadil"})
            if response and response.get('success'):
                self.log_test("Delete Investment", True, f"Deleted investment ID: {inv_id}")
                
                # Verify soft delete - investment should still exist but marked deleted=true
                investments = self.make_request("GET", "/investments", params={"deleted": True})
                if investments:
                    deleted_inv = next((inv for inv in investments if inv['_id'] == inv_id), None)
                    if deleted_inv and deleted_inv.get('deleted') == True:
                        self.log_test("Soft Delete Verification", True, "Investment marked as deleted=true")
                    else:
                        self.log_test("Soft Delete Verification", False, "Investment not found in deleted list")
                else:
                    self.log_test("Soft Delete Verification", False, "Failed to get deleted investments")
            else:
                self.log_test("Delete Investment", False, "Failed to delete investment")
        
        # Delete one milk sale (if we have any)
        if self.created_ids['milk_sales']:
            sale_id = self.created_ids['milk_sales'][0]
            response = self.make_request("DELETE", f"/milk-sales/{sale_id}", params={"user": "Aadil"})
            if response and response.get('success'):
                self.log_test("Delete Milk Sale", True, f"Deleted milk sale ID: {sale_id}")
            else:
                self.log_test("Delete Milk Sale", False, "Failed to delete milk sale")
        
        # Verify dashboard excludes deleted entries
        stats = self.make_request("GET", "/stats/dashboard")
        if stats:
            # After deleting one investment (₹75,000 Aadil) and one milk sale (₹239.4):
            # Total Investment: 50000 (only Imran's)
            # Aadil Investment: 0
            # Imran Investment: 50000
            # Total Earnings: 262.4 (only second milk sale)
            # Net Profit: 262.4 - 42500 = -42237.6
            
            expected_after_delete = {
                'total_investment': 50000,
                'aadil_investment': 0,
                'imran_investment': 50000,
                'total_earnings': 262.4
            }
            
            all_correct = True
            for key, expected_val in expected_after_delete.items():
                actual_val = stats.get(key, 0)
                if abs(actual_val - expected_val) > 0.1:
                    all_correct = False
                    print(f"   ❌ {key}: Expected {expected_val}, Got {actual_val}")
                else:
                    print(f"   ✅ {key}: {actual_val}")
            
            self.log_test("Dashboard Excludes Deleted Entries", all_correct,
                         f"Stats after deletion: {stats}")
        else:
            self.log_test("Dashboard Excludes Deleted Entries", False, "Failed to get dashboard stats")
        
        # Verify deletion notifications created
        notifications = self.make_request("GET", "/notifications")
        if notifications:
            deletion_notifs = [n for n in notifications if n.get('type') == 'deletion']
            expected_deletions = 2  # 1 investment + 1 milk sale
            actual_deletions = len(deletion_notifs)
            
            self.log_test("Deletion Notifications Created", 
                         actual_deletions == expected_deletions,
                         f"Expected: {expected_deletions}, Actual: {actual_deletions}")
        else:
            self.log_test("Deletion Notifications Created", False, "Failed to get notifications")

    def test_8_wrx_notifications(self):
        """Test 8: Test WRX Notifications Features"""
        print("=== TEST 8: WRX NOTIFICATIONS FEATURES ===")
        
        # Get all notifications
        notifications = self.make_request("GET", "/notifications")
        if notifications and len(notifications) > 0:
            self.log_test("GET /api/notifications", True, f"Retrieved {len(notifications)} notifications")
            
            # Test notification message formatting
            first_notif = notifications[0]
            message = first_notif.get('message', '')
            has_descriptive_message = len(message) > 20 and ('₹' in message or 'added' in message or 'removed' in message)
            self.log_test("Descriptive Message Format", has_descriptive_message,
                         f"Sample message: {message}")
            
            # Test reactions - add reactions to first notification
            notif_id = first_notif.get('_id')
            if notif_id:
                reactions = ['👍', '✅', '❌', '❤️', '😊']
                for emoji in reactions:
                    reaction_data = {
                        "notification_id": notif_id,
                        "user": "Aadil",
                        "emoji": emoji
                    }
                    response = self.make_request("POST", "/notifications/react", reaction_data)
                    if response and response.get('success'):
                        self.log_test(f"Add Reaction {emoji}", True, f"Added to notification {notif_id}")
                    else:
                        self.log_test(f"Add Reaction {emoji}", False, "Failed to add reaction")
                
                # Test mark as read
                read_data = {
                    "notification_ids": [notif_id],
                    "user": "Aadil"
                }
                response = self.make_request("POST", "/notifications/mark-read", read_data)
                if response and response.get('success'):
                    self.log_test("Mark Notification as Read", True, f"Marked {notif_id} as read")
                else:
                    self.log_test("Mark Notification as Read", False, "Failed to mark as read")
                
                # Verify reactions and read status were stored
                updated_notifications = self.make_request("GET", "/notifications")
                if updated_notifications:
                    updated_notif = next((n for n in updated_notifications if n.get('_id') == notif_id), None)
                    if updated_notif:
                        reactions_stored = len(updated_notif.get('reactions', {})) == 5
                        read_by_updated = 'Aadil' in updated_notif.get('read_by', [])
                        
                        self.log_test("Reactions Stored Correctly", reactions_stored,
                                     f"Reactions: {updated_notif.get('reactions', {})}")
                        self.log_test("Read Status Updated", read_by_updated,
                                     f"Read by: {updated_notif.get('read_by', [])}")
                    else:
                        self.log_test("Updated Notification Found", False, "Could not find updated notification")
                else:
                    self.log_test("Get Updated Notifications", False, "Failed to get updated notifications")
            else:
                self.log_test("Notification ID Available", False, "No notification ID found")
        else:
            self.log_test("GET /api/notifications", False, "No notifications found")

    def test_9_edge_cases(self):
        """Test 9: Edge Cases and Error Handling"""
        print("=== TEST 9: EDGE CASES ===")
        
        # Test with 0 amount entries
        zero_investment = {
            "amount": 0,
            "date": "2026-03-16",
            "investor": "Aadil",
            "category": "Test Zero"
        }
        
        response = self.make_request("POST", "/investments", zero_investment)
        if response and response.get('success'):
            self.log_test("Zero Amount Investment", True, "Handled gracefully")
        else:
            self.log_test("Zero Amount Investment", False, "Failed to handle zero amount")
        
        # Test with future dates
        future_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        future_milk_sale = {
            "date": future_date,
            "volume": 25.0,
            "fat_percentage": 4.0,
            "rate": 8.4,
            "earnings": 25.0 * 8.4
        }
        
        response = self.make_request("POST", "/milk-sales", future_milk_sale)
        if response and response.get('success'):
            self.log_test("Future Date Entry", True, "Handled gracefully")
        else:
            self.log_test("Future Date Entry", False, "Failed to handle future date")
        
        # Test invalid data (missing required fields)
        invalid_expenditure = {
            "amount": 1000,
            # Missing required fields: date, paid_by, category, subcategory
        }
        
        response = self.make_request("POST", "/expenditures", invalid_expenditure)
        # Should fail with validation error
        self.log_test("Invalid Data Handling", response is None,
                     "Should return validation error for missing fields")

    def test_10_final_verification(self):
        """Test 10: Final State Verification"""
        print("=== TEST 10: FINAL STATE VERIFICATION ===")
        
        # Get final counts
        investments = self.make_request("GET", "/investments")
        expenditures = self.make_request("GET", "/expenditures")
        milk_sales = self.make_request("GET", "/milk-sales")
        dls = self.make_request("GET", "/dairy-lock-sales")
        notifications = self.make_request("GET", "/notifications")
        
        if all([investments is not None, expenditures is not None, milk_sales is not None, 
                dls is not None, notifications is not None]):
            
            # Count non-deleted entries
            active_investments = len([inv for inv in investments if not inv.get('deleted', False)])
            active_expenditures = len([exp for exp in expenditures if not exp.get('deleted', False)])
            active_milk_sales = len([sale for sale in milk_sales if not sale.get('deleted', False)])
            active_dls = len([d for d in dls if not d.get('deleted', False)])
            total_notifications = len(notifications)
            
            print(f"   Final Counts:")
            print(f"   - Active Investments: {active_investments}")
            print(f"   - Active Expenditures: {active_expenditures}")
            print(f"   - Active Milk Sales: {active_milk_sales}")
            print(f"   - Active DLS: {active_dls}")
            print(f"   - Total Notifications: {total_notifications}")
            
            # Expected: 1 investment (after 1 deleted), 2 expenditures, 1 milk sale (after 1 deleted), 
            # 2 DLS, and multiple notifications (original 7 + 2 deletions + 2 edge cases = ~11)
            expected_active = {
                'investments': 1,  # 2 created - 1 deleted
                'expenditures': 2,
                'milk_sales': 1,   # 2 created - 1 deleted  
                'dls': 2,          # March + February
            }
            
            counts_correct = (
                active_investments == expected_active['investments'] and
                active_expenditures == expected_active['expenditures'] and
                active_milk_sales == expected_active['milk_sales'] and
                active_dls == expected_active['dls'] and
                total_notifications >= 9  # At least 9 notifications expected
            )
            
            self.log_test("Final State Verification", counts_correct,
                         f"Expected active entries: {expected_active}, Notifications: {total_notifications}")
        else:
            self.log_test("Final State Verification", False, "Failed to get final state data")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 STARTING COMPREHENSIVE WAZIR DAIRY FARMING APP TESTING")
        print("=" * 80)
        
        try:
            self.test_1_verify_clean_state()
            self.test_2_user_authentication()
            self.test_3_complete_user_journey()
            self.test_4_dashboard_calculations()
            self.test_5_notifications_created()
            self.test_6_current_month_dls()
            self.test_7_delete_operations()
            self.test_8_wrx_notifications()
            self.test_9_edge_cases()
            self.test_10_final_verification()
            
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")
            self.log_test("Test Execution", False, f"Critical error: {e}")
        
        # Summary
        print("=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for test in self.test_results:
                if not test['success']:
                    print(f"   - {test['test']}: {test['details']}")
        
        print("\n🎯 TESTING COMPLETE")
        return passed_tests, failed_tests

if __name__ == "__main__":
    print(f"Backend URL: {BACKEND_URL}")
    tester = WazirDairyTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with error code if tests failed
    sys.exit(0 if failed == 0 else 1)