#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Wazir Dairy Farming
Tests all endpoints with realistic data and verifies functionality
"""

import requests
import json
from datetime import datetime
import sys
import os

# Backend URL from frontend environment
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
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def test_health_check(self):
        """Test basic API health"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "Wazir Dairy Farming API" in data.get("message", ""):
                    self.log_result("Health Check", True, "API is responding correctly")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_user_setup(self):
        """Test user setup endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/auth/setup")
            if response.status_code == 200:
                data = response.json()
                self.log_result("User Setup", True, f"Setup successful: {data.get('message')}")
                return True
            else:
                self.log_result("User Setup", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("User Setup", False, f"Error: {str(e)}")
            return False
    
    def test_valid_login(self):
        """Test login with valid credentials"""
        try:
            login_data = {
                "name": "Aadil",
                "pin": "1234"
            }
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("user", {}).get("name") == "Aadil":
                    self.log_result("Valid Login", True, f"Login successful for Aadil")
                    return True
                else:
                    self.log_result("Valid Login", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Valid Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Valid Login", False, f"Error: {str(e)}")
            return False
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        try:
            login_data = {
                "name": "Aadil",
                "pin": "9999"  # Wrong PIN
            }
            response = self.session.post(f"{self.base_url}/auth/login", json=login_data)
            if response.status_code == 401:
                self.log_result("Invalid Login", True, "Correctly rejected invalid credentials")
                return True
            else:
                self.log_result("Invalid Login", False, f"Expected 401, got {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Invalid Login", False, f"Error: {str(e)}")
            return False
    
    def test_create_investment(self):
        """Test creating an investment"""
        try:
            investment_data = {
                "amount": 50000.0,
                "date": "2024-01-15",
                "investor": "Aadil",
                "category": "Cattle Purchase",
                "deleted": False
            }
            response = self.session.post(f"{self.base_url}/investments", json=investment_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.created_ids['investments'].append(data["id"])
                    self.log_result("Create Investment", True, f"Investment created with ID: {data['id']}")
                    return True
                else:
                    self.log_result("Create Investment", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Create Investment", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Investment", False, f"Error: {str(e)}")
            return False
    
    def test_get_investments(self):
        """Test retrieving investments"""
        try:
            response = self.session.get(f"{self.base_url}/investments")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Investments", True, f"Retrieved {len(data)} investments")
                    return True
                else:
                    self.log_result("Get Investments", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_result("Get Investments", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get Investments", False, f"Error: {str(e)}")
            return False
    
    def test_create_expenditure(self):
        """Test creating an expenditure"""
        try:
            expenditure_data = {
                "amount": 15000.0,
                "date": "2024-01-16",
                "paid_by": "Imran",
                "category": "Feed",
                "subcategory": "Cattle Feed",
                "deleted": False
            }
            response = self.session.post(f"{self.base_url}/expenditures", json=expenditure_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.created_ids['expenditures'].append(data["id"])
                    self.log_result("Create Expenditure", True, f"Expenditure created with ID: {data['id']}")
                    return True
                else:
                    self.log_result("Create Expenditure", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Create Expenditure", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Expenditure", False, f"Error: {str(e)}")
            return False
    
    def test_get_expenditures(self):
        """Test retrieving expenditures"""
        try:
            response = self.session.get(f"{self.base_url}/expenditures")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Expenditures", True, f"Retrieved {len(data)} expenditures")
                    return True
                else:
                    self.log_result("Get Expenditures", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_result("Get Expenditures", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get Expenditures", False, f"Error: {str(e)}")
            return False
    
    def test_create_milk_sale(self):
        """Test creating a milk sale"""
        try:
            milk_sale_data = {
                "date": "2024-01-17",
                "volume": 25.5,
                "fat_percentage": 4.2,
                "rate": 8.4,
                "earnings": 214.2,
                "deleted": False
            }
            response = self.session.post(f"{self.base_url}/milk-sales", json=milk_sale_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.created_ids['milk_sales'].append(data["id"])
                    self.log_result("Create Milk Sale", True, f"Milk sale created with ID: {data['id']}")
                    return True
                else:
                    self.log_result("Create Milk Sale", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Create Milk Sale", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Milk Sale", False, f"Error: {str(e)}")
            return False
    
    def test_get_milk_sales(self):
        """Test retrieving milk sales"""
        try:
            response = self.session.get(f"{self.base_url}/milk-sales")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Milk Sales", True, f"Retrieved {len(data)} milk sales")
                    return True
                else:
                    self.log_result("Get Milk Sales", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_result("Get Milk Sales", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get Milk Sales", False, f"Error: {str(e)}")
            return False
    
    def test_create_dairy_lock_sale(self):
        """Test creating a dairy lock sale"""
        try:
            dls_data = {
                "month": 1,
                "year": 2024,
                "amount": 8500.0,
                "date": "2024-01-31",
                "notes": "January DLS payment",
                "deleted": False
            }
            response = self.session.post(f"{self.base_url}/dairy-lock-sales", json=dls_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.created_ids['dairy_lock_sales'].append(data["id"])
                    self.log_result("Create Dairy Lock Sale", True, f"DLS created with ID: {data['id']}")
                    return True
                else:
                    self.log_result("Create Dairy Lock Sale", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Create Dairy Lock Sale", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Dairy Lock Sale", False, f"Error: {str(e)}")
            return False
    
    def test_get_dairy_lock_sales(self):
        """Test retrieving dairy lock sales"""
        try:
            response = self.session.get(f"{self.base_url}/dairy-lock-sales")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Dairy Lock Sales", True, f"Retrieved {len(data)} DLS entries")
                    return True
                else:
                    self.log_result("Get Dairy Lock Sales", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_result("Get Dairy Lock Sales", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get Dairy Lock Sales", False, f"Error: {str(e)}")
            return False
    
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        try:
            response = self.session.get(f"{self.base_url}/stats/dashboard")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_investment', 'aadil_investment', 'imran_investment', 
                                 'total_earnings', 'total_expenditure', 'net_profit', 'total_dls']
                
                if all(field in data for field in required_fields):
                    self.log_result("Dashboard Stats", True, f"All stats calculated correctly: {data}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("Dashboard Stats", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_result("Dashboard Stats", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Dashboard Stats", False, f"Error: {str(e)}")
            return False
    
    def test_get_notifications(self):
        """Test retrieving notifications"""
        try:
            response = self.session.get(f"{self.base_url}/notifications")
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Notifications", True, f"Retrieved {len(data)} notifications")
                    return True
                else:
                    self.log_result("Get Notifications", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_result("Get Notifications", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get Notifications", False, f"Error: {str(e)}")
            return False
    
    def test_notification_reactions(self):
        """Test adding reactions to notifications"""
        try:
            # First get notifications to find one to react to
            response = self.session.get(f"{self.base_url}/notifications")
            if response.status_code != 200:
                self.log_result("Notification Reactions", False, "Could not fetch notifications for testing")
                return False
                
            notifications = response.json()
            if not notifications:
                self.log_result("Notification Reactions", False, "No notifications available for testing")
                return False
            
            # React to the first notification
            notif_id = notifications[0]["_id"]
            reaction_data = {
                "notification_id": notif_id,
                "user": "Aadil",
                "emoji": "👍"
            }
            
            response = self.session.post(f"{self.base_url}/notifications/react", json=reaction_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("Notification Reactions", True, f"Reaction added successfully")
                    return True
                else:
                    self.log_result("Notification Reactions", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Notification Reactions", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Notification Reactions", False, f"Error: {str(e)}")
            return False
    
    def test_mark_notifications_read(self):
        """Test marking notifications as read"""
        try:
            # First get notifications to find ones to mark as read
            response = self.session.get(f"{self.base_url}/notifications")
            if response.status_code != 200:
                self.log_result("Mark Notifications Read", False, "Could not fetch notifications for testing")
                return False
                
            notifications = response.json()
            if not notifications:
                self.log_result("Mark Notifications Read", False, "No notifications available for testing")
                return False
            
            # Mark first notification as read
            notif_ids = [notifications[0]["_id"]]
            read_data = {
                "notification_ids": notif_ids,
                "user": "Aadil"
            }
            
            response = self.session.post(f"{self.base_url}/notifications/mark-read", json=read_data)
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("Mark Notifications Read", True, f"Notifications marked as read")
                    return True
                else:
                    self.log_result("Mark Notifications Read", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Mark Notifications Read", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Mark Notifications Read", False, f"Error: {str(e)}")
            return False
    
    def test_soft_delete_investment(self):
        """Test soft deleting an investment"""
        if not self.created_ids['investments']:
            self.log_result("Soft Delete Investment", False, "No investments available for deletion testing")
            return False
            
        try:
            investment_id = self.created_ids['investments'][0]
            response = self.session.delete(f"{self.base_url}/investments/{investment_id}?user=Aadil")
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_result("Soft Delete Investment", True, f"Investment soft deleted successfully")
                    return True
                else:
                    self.log_result("Soft Delete Investment", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Soft Delete Investment", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Soft Delete Investment", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Wazir Dairy Farming Backend API Tests")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_health_check,
            self.test_user_setup,
            self.test_valid_login,
            self.test_invalid_login,
            self.test_create_investment,
            self.test_get_investments,
            self.test_create_expenditure,
            self.test_get_expenditures,
            self.test_create_milk_sale,
            self.test_get_milk_sales,
            self.test_create_dairy_lock_sale,
            self.test_get_dairy_lock_sales,
            self.test_dashboard_stats,
            self.test_get_notifications,
            self.test_notification_reactions,
            self.test_mark_notifications_read,
            self.test_soft_delete_investment
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
                failed += 1
            print()  # Add spacing between tests
        
        print("=" * 60)
        print(f"🏁 Test Summary: {passed} passed, {failed} failed")
        
        if failed > 0:
            print("\n❌ CRITICAL ISSUES FOUND:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        else:
            print("\n✅ All tests passed! Backend API is working correctly.")
        
        return failed == 0

if __name__ == "__main__":
    tester = WazirDairyTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)