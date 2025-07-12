#!/usr/bin/env python3
"""
Test user_app.py for template issues
"""

import user_app

def test_user_dashboard():
    app = user_app.app
    print("Testing user_app.py routes:")
    
    # List all routes
    for rule in app.url_map.iter_rules():
        print(f"Route: {rule.endpoint} -> {rule.rule}")
    
    # Test dashboard route
    with app.test_client() as client:
        try:
            response = client.get('/dashboard')
            print(f"\nDashboard route status: {response.status_code}")
            if response.status_code != 200:
                print("Error details:")
                print(response.get_data(as_text=True))
            else:
                print("✓ Dashboard loads successfully")
        except Exception as e:
            print(f"✗ Dashboard error: {e}")

if __name__ == '__main__':
    test_user_dashboard()