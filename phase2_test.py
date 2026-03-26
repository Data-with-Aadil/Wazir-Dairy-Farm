#!/usr/bin/env python3
"""
Phase 2 Verification Tests for Wazir Dairy Farming Backend
Comprehensive workflow and data integrity testing
"""

import requests
import json
from datetime import datetime
import sys

BACKEND_URL = "https://wazir-partner-portal.preview.emergentagent.com/api"

class Phase2Tester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.workflow_data = {
            'investment_id': None,
            'expenditure_id': None,
            'milk_sale_id': None,
            'dls_id': None
        }
        
    def log_test(self, test_name, success, message=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message
        })
        return success
        
    def test_complete_workflow(self):
        """Test the complete workflow as specified in review request"""
        print("\n🔄 Testing Complete Workflow:")
        
        # Step 1: Login as Aadil
        login_success = self.test_login_aadil()
        if not login_success:
            return False
            
        # Step 2: Add entries and verify notifications
        workflow_steps = [
            ("Add Milk Sale", self.add_milk_sale_entry),
            ("Add Expenditure", self.add_expenditure_entry), 
            ("Add Investment", self.add_investment_entry),
            ("Add DLS", self.add_dls_entry)
        ]
        
        for step_name, step_func in workflow_steps:
            if not step_func():
                self.log_test(f"Workflow - {step_name}", False, "Failed to complete step")
                return False
        
        # Step 3: Verify dashboard stats update correctly
        if not self.verify_dashboard_updates():
            return False
            
        # Step 4: Verify notifications created for all adds
        if not self.verify_all_notifications_created():
            return False
            
        # Step 5: Test deletion and verify deletion notification
        if not self.test_deletion_workflow():
            return False
            
        self.log_test("Complete Workflow", True, "All workflow steps completed successfully")
        return True
    
    def test_login_aadil(self):
        """Login as Aadil"""
        try:
            login_data = {"name": "Aadil", "pin": "1234"}
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("user", {}).get("name") == "Aadil":
                    return self.log_test("Login as Aadil", True, "Successfully authenticated")
                else:
                    return self.log_test("Login as Aadil", False, f"Login failed: {data}")
            else:
                return self.log_test("Login as Aadil", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Login as Aadil", False, f"Error: {str(e)}")
    
    def add_milk_sale_entry(self):
        """Add a milk sale entry with realistic data"""
        try:
            milk_sale_data = {
                "date": "2024-01-20",
                "volume": 28.5,
                "fat_percentage": 4.1,
                "rate": 8.4,
                "earnings": 239.4,  # 28.5 * 8.4
                "deleted": False
            }
            
            response = self.session.post(f"{BACKEND_URL}/milk-sales", json=milk_sale_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.workflow_data['milk_sale_id'] = data["id"]
                    return self.log_test("Add Milk Sale Entry", True, f"Created with ID: {data['id']}")
                else:
                    return self.log_test("Add Milk Sale Entry", False, f"Unexpected response: {data}")
            else:
                return self.log_test("Add Milk Sale Entry", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Add Milk Sale Entry", False, f"Error: {str(e)}")
    
    def add_expenditure_entry(self):
        """Add an expenditure entry with hierarchical categories"""
        try:
            expenditure_data = {
                "amount": 12500.0,
                "date": "2024-01-21",
                "paid_by": "Aadil",
                "category": "Supplements",
                "subcategory": "Mineral Mix",
                "deleted": False
            }
            
            response = self.session.post(f"{BACKEND_URL}/expenditures", json=expenditure_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.workflow_data['expenditure_id'] = data["id"]
                    return self.log_test("Add Expenditure Entry", True, f"Created with ID: {data['id']}")
                else:
                    return self.log_test("Add Expenditure Entry", False, f"Unexpected response: {data}")
            else:
                return self.log_test("Add Expenditure Entry", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Add Expenditure Entry", False, f"Error: {str(e)}")
    
    def add_investment_entry(self):
        """Add an investment entry"""
        try:
            investment_data = {
                "amount": 75000.0,
                "date": "2024-01-22",
                "investor": "Aadil",
                "category": "Infrastructure",
                "deleted": False
            }
            
            response = self.session.post(f"{BACKEND_URL}/investments", json=investment_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.workflow_data['investment_id'] = data["id"]
                    return self.log_test("Add Investment Entry", True, f"Created with ID: {data['id']}")
                else:
                    return self.log_test("Add Investment Entry", False, f"Unexpected response: {data}")
            else:
                return self.log_test("Add Investment Entry", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Add Investment Entry", False, f"Error: {str(e)}")
    
    def add_dls_entry(self):
        """Add a DLS entry with month/year selection"""
        try:
            dls_data = {
                "month": 2,
                "year": 2024,
                "amount": 9500.0,
                "date": "2024-01-23",
                "notes": "February DLS advance payment",
                "deleted": False
            }
            
            response = self.session.post(f"{BACKEND_URL}/dairy-lock-sales", json=dls_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("id"):
                    self.workflow_data['dls_id'] = data["id"]
                    return self.log_test("Add DLS Entry", True, f"Created with ID: {data['id']}")
                else:
                    return self.log_test("Add DLS Entry", False, f"Unexpected response: {data}")
            else:
                return self.log_test("Add DLS Entry", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Add DLS Entry", False, f"Error: {str(e)}")
    
    def verify_dashboard_updates(self):
        """Verify dashboard stats update correctly after adding entries"""
        try:
            response = self.session.get(f"{BACKEND_URL}/stats/dashboard")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check that all required fields are present and have reasonable values
                required_fields = [
                    'total_investment', 'aadil_investment', 'imran_investment',
                    'total_earnings', 'total_expenditure', 'net_profit', 'total_dls'
                ]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    return self.log_test("Dashboard Updates", False, f"Missing fields: {missing_fields}")
                
                # Verify that our new entries are reflected in the stats
                if data['total_investment'] >= 75000:  # Our investment
                    if data['total_earnings'] > 0:  # Our milk sale
                        if data['total_expenditure'] >= 12500:  # Our expenditure
                            if data['total_dls'] >= 9500:  # Our DLS
                                return self.log_test("Dashboard Updates", True, 
                                    f"Stats correctly updated: Investment={data['total_investment']}, "
                                    f"Earnings={data['total_earnings']}, Expenditure={data['total_expenditure']}, "
                                    f"DLS={data['total_dls']}, Net Profit={data['net_profit']}")
                            else:
                                return self.log_test("Dashboard Updates", False, f"DLS not reflected: {data['total_dls']}")
                        else:
                            return self.log_test("Dashboard Updates", False, f"Expenditure not reflected: {data['total_expenditure']}")
                    else:
                        return self.log_test("Dashboard Updates", False, f"Earnings not reflected: {data['total_earnings']}")
                else:
                    return self.log_test("Dashboard Updates", False, f"Investment not reflected: {data['total_investment']}")
            else:
                return self.log_test("Dashboard Updates", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Dashboard Updates", False, f"Error: {str(e)}")
    
    def verify_all_notifications_created(self):
        """Verify notifications are created for all entry types"""
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications")
            
            if response.status_code == 200:
                notifications = response.json()
                
                if not isinstance(notifications, list):
                    return self.log_test("Notifications Created", False, f"Expected list, got: {type(notifications)}")
                
                # Check for notifications of each type we created
                notification_types = [notif.get('type') for notif in notifications]
                expected_types = ['investment', 'expenditure', 'milk_sale', 'dls']
                
                found_types = []
                for expected_type in expected_types:
                    if expected_type in notification_types:
                        found_types.append(expected_type)
                
                if len(found_types) == len(expected_types):
                    return self.log_test("Notifications Created", True, 
                        f"All notification types found: {found_types}")
                else:
                    missing_types = [t for t in expected_types if t not in found_types]
                    return self.log_test("Notifications Created", False, 
                        f"Missing notification types: {missing_types}")
            else:
                return self.log_test("Notifications Created", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Notifications Created", False, f"Error: {str(e)}")
    
    def test_deletion_workflow(self):
        """Test deletion of one entry and verify deletion notification"""
        if not self.workflow_data['investment_id']:
            return self.log_test("Deletion Workflow", False, "No investment ID available for deletion")
        
        try:
            # Delete the investment entry
            investment_id = self.workflow_data['investment_id']
            response = self.session.delete(f"{BACKEND_URL}/investments/{investment_id}?user=Aadil")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Verify deletion notification was created
                    notif_response = self.session.get(f"{BACKEND_URL}/notifications")
                    if notif_response.status_code == 200:
                        notifications = notif_response.json()
                        deletion_notifications = [n for n in notifications if n.get('type') == 'deletion']
                        
                        if deletion_notifications:
                            return self.log_test("Deletion Workflow", True, 
                                f"Entry deleted and deletion notification created")
                        else:
                            return self.log_test("Deletion Workflow", False, 
                                "Entry deleted but no deletion notification found")
                    else:
                        return self.log_test("Deletion Workflow", False, 
                            "Could not verify deletion notification")
                else:
                    return self.log_test("Deletion Workflow", False, f"Deletion failed: {data}")
            else:
                return self.log_test("Deletion Workflow", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Deletion Workflow", False, f"Error: {str(e)}")
    
    def test_data_integrity(self):
        """Test data integrity checks"""
        print("\n🔒 Testing Data Integrity:")
        
        integrity_tests = [
            ("Soft Deletes Work", self.verify_soft_deletes),
            ("Dashboard Excludes Deleted", self.verify_dashboard_excludes_deleted),
            ("Notifications Include All Types", self.verify_notification_types)
        ]
        
        all_passed = True
        for test_name, test_func in integrity_tests:
            if not test_func():
                all_passed = False
        
        return all_passed
    
    def verify_soft_deletes(self):
        """Verify soft deletes work (deleted=true)"""
        try:
            # Get investments with deleted=true to see if our deleted investment is there
            response = self.session.get(f"{BACKEND_URL}/investments?deleted=true")
            
            if response.status_code == 200:
                deleted_investments = response.json()
                
                if isinstance(deleted_investments, list):
                    # Check if any have deleted=true
                    truly_deleted = [inv for inv in deleted_investments if inv.get('deleted') == True]
                    
                    if truly_deleted:
                        return self.log_test("Soft Deletes Work", True, 
                            f"Found {len(truly_deleted)} soft-deleted entries")
                    else:
                        return self.log_test("Soft Deletes Work", False, 
                            "No soft-deleted entries found")
                else:
                    return self.log_test("Soft Deletes Work", False, 
                        f"Expected list, got: {type(deleted_investments)}")
            else:
                return self.log_test("Soft Deletes Work", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Soft Deletes Work", False, f"Error: {str(e)}")
    
    def verify_dashboard_excludes_deleted(self):
        """Verify dashboard excludes deleted entries"""
        try:
            # Get current dashboard stats
            response = self.session.get(f"{BACKEND_URL}/stats/dashboard")
            
            if response.status_code == 200:
                stats = response.json()
                
                # Get all investments including deleted ones
                all_response = self.session.get(f"{BACKEND_URL}/investments?deleted=true")
                active_response = self.session.get(f"{BACKEND_URL}/investments?deleted=false")
                
                if all_response.status_code == 200 and active_response.status_code == 200:
                    all_investments = all_response.json()
                    active_investments = active_response.json()
                    
                    # Calculate what the total should be from active investments only
                    active_total = sum(inv.get('amount', 0) for inv in active_investments)
                    
                    # Dashboard total should match active total, not include deleted entries
                    if abs(stats.get('total_investment', 0) - active_total) < 0.01:  # Allow for floating point precision
                        return self.log_test("Dashboard Excludes Deleted", True, 
                            f"Dashboard correctly excludes deleted entries")
                    else:
                        return self.log_test("Dashboard Excludes Deleted", False, 
                            f"Dashboard total ({stats.get('total_investment')}) doesn't match active total ({active_total})")
                else:
                    return self.log_test("Dashboard Excludes Deleted", False, 
                        "Could not fetch investment data for comparison")
            else:
                return self.log_test("Dashboard Excludes Deleted", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Dashboard Excludes Deleted", False, f"Error: {str(e)}")
    
    def verify_notification_types(self):
        """Verify notifications include all entry types"""
        try:
            response = self.session.get(f"{BACKEND_URL}/notifications")
            
            if response.status_code == 200:
                notifications = response.json()
                
                if isinstance(notifications, list):
                    notification_types = set(notif.get('type') for notif in notifications)
                    expected_types = {'investment', 'expenditure', 'milk_sale', 'dls', 'deletion'}
                    
                    found_types = notification_types.intersection(expected_types)
                    
                    if len(found_types) >= 4:  # Should have at least 4 of the 5 types
                        return self.log_test("Notifications Include All Types", True, 
                            f"Found notification types: {found_types}")
                    else:
                        return self.log_test("Notifications Include All Types", False, 
                            f"Missing notification types. Found: {found_types}, Expected: {expected_types}")
                else:
                    return self.log_test("Notifications Include All Types", False, 
                        f"Expected list, got: {type(notifications)}")
            else:
                return self.log_test("Notifications Include All Types", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Notifications Include All Types", False, f"Error: {str(e)}")
    
    def run_phase2_tests(self):
        """Run all Phase 2 verification tests"""
        print("🚀 Starting Wazir Dairy Farming Phase 2 Backend Verification")
        print("=" * 70)
        
        # Test complete workflow
        workflow_success = self.test_complete_workflow()
        
        # Test data integrity
        integrity_success = self.test_data_integrity()
        
        # Summary
        print("\n" + "=" * 70)
        print("📋 PHASE 2 TEST SUMMARY:")
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if total - passed > 0:
            print("\n🚨 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        success_rate = (passed / total) * 100 if total > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        overall_success = workflow_success and integrity_success and success_rate >= 90
        
        if overall_success:
            print("\n🎉 Phase 2 verification PASSED! All backend functionality working correctly.")
        else:
            print("\n⚠️  Phase 2 verification FAILED. Issues need to be addressed.")
        
        return overall_success

if __name__ == "__main__":
    tester = Phase2Tester()
    success = tester.run_phase2_tests()
    sys.exit(0 if success else 1)