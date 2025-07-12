#!/usr/bin/env python3
"""
Simple test script to verify company_app.py works correctly
This can help debug Render deployment issues
"""

import os
import sys

def test_imports():
    """Test if all imports work correctly"""
    try:
        print("Testing imports...")
        import flask
        print(f"✓ Flask version: {flask.__version__}")
        
        import pymongo
        print(f"✓ PyMongo version: {pymongo.__version__}")
        
        import werkzeug
        print(f"✓ Werkzeug version: {werkzeug.__version__}")
        
        # Test company_app import
        import company_app
        print("✓ company_app.py imports successfully")
        
        return True
    except Exception as e:
        print(f"✗ Import error: {e}")
        return False

def test_app_creation():
    """Test if Flask app is created correctly"""
    try:
        import company_app
        app = company_app.app
        print(f"✓ Flask app created: {app}")
        print(f"✓ Secret key configured: {bool(app.secret_key)}")
        print(f"✓ ProxyFix enabled: {hasattr(app.wsgi_app, 'x_proto')}")
        return True
    except Exception as e:
        print(f"✗ App creation error: {e}")
        return False

def test_mongodb():
    """Test MongoDB connection"""
    try:
        import company_app
        print(f"✓ MongoDB connected: {company_app.mongo_connected}")
        if company_app.mongo_client:
            # Test ping
            company_app.mongo_client.admin.command('ping')
            print("✓ MongoDB ping successful")
        return True
    except Exception as e:
        print(f"✗ MongoDB error: {e}")
        return False

def test_routes():
    """Test if routes are accessible"""
    try:
        import company_app
        app = company_app.app
        with app.test_client() as client:
            # Test main route
            response = client.get('/')
            print(f"✓ Main route status: {response.status_code}")
            
            # Test API route
            response = client.get('/api/here-keys')
            print(f"✓ API route status: {response.status_code}")
            
        return True
    except Exception as e:
        print(f"✗ Route test error: {e}")
        return False

def main():
    """Run all tests"""
    print("=== Company App Test Suite ===")
    print(f"Python version: {sys.version}")
    print(f"Environment variables:")
    print(f"  PORT: {os.environ.get('PORT', 'not set')}")
    print(f"  MONGODB_URI: {'set' if os.environ.get('MONGODB_URI') else 'not set'}")
    print(f"  SESSION_SECRET: {'set' if os.environ.get('SESSION_SECRET') else 'not set'}")
    print()
    
    tests = [
        ("Import Test", test_imports),
        ("App Creation Test", test_app_creation),
        ("MongoDB Test", test_mongodb),
        ("Routes Test", test_routes)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"=== {test_name} ===")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"✗ {test_name} failed with exception: {e}")
            results.append((test_name, False))
        print()
    
    print("=== Test Summary ===")
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    all_passed = all(result for _, result in results)
    print(f"\nOverall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    
    if all_passed:
        print("\n✓ company_app.py is ready for Render deployment!")
    else:
        print("\n✗ Issues found - check logs above for details")

if __name__ == '__main__':
    main()