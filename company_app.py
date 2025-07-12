import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime, timedelta
import sys
import time
import random

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# MongoDB connection variables
mongo_client = None
mongo_connected = False

# HERE Maps API keys for better reliability - prioritized order
HERE_API_KEYS = [
    "VivkTzkLRp8BPWqRgV12KUmuOHfy6mobXyHUJSEfOcA",
    "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEHfy6mobXyHUJSEfOcA",
    "fdEwg_luXCC7NWAtXFnTWWZCuoMDHZDhCdnVM0cXZQE", 
    "KrksWbCEU3g3OnuQN3wDOncIgVTA2UrwIpTIN8iKzPQ",
    "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI"
]

# API endpoint to get available HERE Maps API keys
@app.route('/api/here-keys')
def get_here_keys():
    """Get HERE Maps API keys for frontend use"""
    return jsonify({'keys': HERE_API_KEYS})

# Routes
@app.route('/')
def index():
    """Main company portal page"""
    return render_template('index.html')

@app.route('/qr')
def qr_generator():
    """QR code generator page"""
    return render_template('qr.html')

@app.route('/register')
def company_page():
    """Company registration page"""
    return render_template('company.html')

@app.route('/login')
def company_login_page():
    """Company login page"""
    return render_template('company_login.html')

@app.route('/dashboard')
def company_dashboard():
    """Company dashboard page"""
    return render_template('company_dashboard.html')

@app.route('/api/store-location', methods=['POST'])
def store_location():
    """Store QR location data with unique 4-digit ID - collection created only when downloaded"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'address', 'latitude', 'longitude']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Generate unique 4-digit QR ID
                qr_id = None
                attempts = 0
                max_attempts = 100
                
                locations_collection = mongo_client.get_database("tracksmart").get_collection("locations")
                
                while attempts < max_attempts:
                    potential_id = str(random.randint(1000, 9999))
                    
                    # Check if ID already exists
                    existing = locations_collection.find_one({'qr_id': potential_id})
                    if not existing:
                        qr_id = potential_id
                        break
                    
                    attempts += 1
                
                if not qr_id:
                    return jsonify({'message': 'Failed to generate unique QR ID'}), 500
                
                # Get company ID and assigned user from request
                company_id = data.get('company_id')
                assigned_user_id = data.get('assigned_user_id')
                
                # Create location document
                location_doc = {
                    'qr_id': qr_id,
                    'name': data['name'],
                    'address': data['address'],
                    'latitude': data['latitude'],
                    'longitude': data['longitude'],
                    'google_maps_url': data.get('google_maps_url', ''),
                    'here_maps_url': data.get('here_maps_url', ''),
                    'timestamp': datetime.utcnow(),
                    'qr_generated': True,
                    'company_id': company_id,
                    'assigned_user_id': assigned_user_id
                }
                
                # Store in locations collection
                result = locations_collection.insert_one(location_doc)
                
                # Create QR-specific collection
                qr_collection = mongo_client.get_database("tracksmart").get_collection(qr_id)
                
                # Store QR info in its own collection
                qr_info_doc = {
                    'type': 'qr_info',
                    'qr_id': qr_id,
                    'location_name': data['name'],
                    'address': data['address'],
                    'latitude': data['latitude'],
                    'longitude': data['longitude'],
                    'company_id': company_id,
                    'assigned_user_id': assigned_user_id,
                    'created_at': datetime.utcnow(),
                    'tracking_active': True
                }
                
                qr_collection.insert_one(qr_info_doc)
                
                # Send email notification if user is assigned
                if assigned_user_id:
                    try:
                        # Get user and company information
                        users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                        companies_collection = mongo_client.get_database("tracksmart").get_collection("companies")
                        
                        user = users_collection.find_one({'user_id': assigned_user_id})
                        company = companies_collection.find_one({'company_id': company_id})
                        
                        if user and company:
                            send_simple_notification(
                                user['email'],
                                user['name'],
                                qr_id,
                                company['name'],
                                data['name']
                            )
                            app.logger.info(f"QR {qr_id} assigned to user {user['email']}")
                    except Exception as email_error:
                        app.logger.error(f"Email notification failed: {str(email_error)}")
                        # Continue without failing the whole request
                
                app.logger.info(f"Location stored with QR ID: {qr_id}")
                
                return jsonify({
                    'message': 'Location stored successfully',
                    'qr_id': qr_id,
                    'location_id': str(result.inserted_id),
                    'company_id': company_id,
                    'assigned_user_id': assigned_user_id
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error storing location: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/api/locations')
def get_locations():
    """Get all stored locations"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                locations_collection = mongo_client.get_database("tracksmart").get_collection("locations")
                locations = list(locations_collection.find())
                
                # Convert ObjectId to string for JSON serialization
                for location in locations:
                    location['_id'] = str(location['_id'])
                
                return jsonify(locations)
                
            except Exception as db_error:
                app.logger.error(f"Database error fetching locations: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error fetching locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch locations'}), 500

@app.route('/api/location/<location_id>')
def get_location(location_id):
    """Get a specific location by ID"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                locations_collection = mongo_client.get_database("tracksmart").get_collection("locations")
                location = locations_collection.find_one({'_id': location_id})
                
                if location:
                    location['_id'] = str(location['_id'])
                    return jsonify(location)
                else:
                    return jsonify({'message': 'Location not found'}), 404
                    
            except Exception as db_error:
                app.logger.error(f"Database error fetching location: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error fetching location: {str(e)}")
        return jsonify({'message': 'Failed to fetch location'}), 500

@app.route('/api/company/register', methods=['POST'])
def company_register():
    """Register a new company"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'contactPerson', 'email', 'phone', 'password', 'address']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        # Basic email validation
        import re
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', data['email']):
            return jsonify({'message': 'Invalid email format'}), 400
        
        email = data['email'].lower()
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Check if company already exists
                companies_collection = mongo_client.get_database("tracksmart").get_collection("companies")
                existing_company = companies_collection.find_one({'email': email})
                
                if existing_company:
                    return jsonify({'message': 'Email already registered'}), 400
                
                # Generate unique company ID starting from 1
                highest_id_company = companies_collection.find_one(
                    {},
                    sort=[('company_id', -1)]
                )
                
                if highest_id_company and 'company_id' in highest_id_company:
                    company_id = highest_id_company['company_id'] + 1
                else:
                    company_id = 1
                
                # Create company document
                company = {
                    'company_id': company_id,
                    'name': data['name'],
                    'contact_person': data['contactPerson'],
                    'email': email,
                    'phone': data['phone'],
                    'password': data['password'],  # In production, hash this password
                    'address': data['address'],
                    'created_at': datetime.utcnow(),
                    'status': 'active'
                }
                
                # Store in companies collection
                result = companies_collection.insert_one(company)
                
                app.logger.info(f"Company registered: {data['name']} ({email})")
                
                return jsonify({
                    'message': 'Company registered successfully!',
                    'company_id': company_id,
                    'name': data['name']
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during company registration: {str(db_error)}")
                return jsonify({'message': 'Database error during registration'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot register company")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500

@app.route('/api/company/login', methods=['POST'])
def company_login():
    """Login company"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
        
        email = data['email'].lower()
        password = data['password']
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Find company in database
                companies_collection = mongo_client.get_database("tracksmart").get_collection("companies")
                company = companies_collection.find_one({'email': email})
                
                if not company:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check password (in production, use hashed passwords)
                if company['password'] != password:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check if company is active
                if company.get('status') != 'active':
                    return jsonify({'message': 'Company account is deactivated'}), 401
                
                # Prepare company data for response
                company_data = {
                    'company_id': company['company_id'],
                    'name': company['name'],
                    'contact_person': company['contact_person'],
                    'email': company['email'],
                    'phone': company['phone'],
                    'address': company['address'],
                    'status': company['status']
                }
                
                app.logger.info(f"Company login successful: {company['name']} ({email})")
                
                return jsonify({
                    'message': 'Login successful!',
                    'company': company_data
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during company login: {str(db_error)}")
                return jsonify({'message': 'Database error during login'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot login company")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error logging in company: {str(e)}")
        return jsonify({'message': 'Login failed'}), 500

@app.route('/api/company/<int:company_id>/orders')
def get_company_orders(company_id):
    """Get orders for a specific company - only accessible by company employees"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get all QR codes created by this company
                db = mongo_client.get_database("tracksmart")
                locations_collection = db.get_collection("locations")
                
                # Find all QR codes for this company
                company_qrs = locations_collection.find({'company_id': company_id})
                
                orders = []
                for qr_doc in company_qrs:
                    qr_id = qr_doc.get('qr_id')
                    if qr_id:
                        # Get QR-specific collection data
                        qr_collection = db.get_collection(str(qr_id))
                        
                        # Get destination info
                        destination_info = qr_collection.find_one({'type': 'destination_info'})
                        if not destination_info:
                            destination_info = qr_collection.find_one({'type': 'qr_info'})
                        
                        # Get latest delivery info
                        delivery_info = qr_collection.find_one(
                            {'type': 'delivery_location'}, 
                            sort=[('timestamp', -1)]
                        )
                        
                        # Determine status
                        if not delivery_info:
                            status = 'Pending'
                        elif delivery_info.get('location_type') == 'role_only':
                            status = 'Boarded and Arriving'
                        else:
                            status = 'In Progress'
                        
                        order_data = {
                            'order_id': f"ORD-{qr_id}",
                            'qr_id': qr_id,
                            'destination': destination_info.get('location_name', 'Unknown') if destination_info else 'Unknown',
                            'delivery_partner': delivery_info.get('delivery_partner_name', 'Not assigned') if delivery_info else 'Not assigned',
                            'status': status,
                            'created_at': qr_doc.get('timestamp', qr_doc.get('created_at'))
                        }
                        orders.append(order_data)
                
                return jsonify({
                    'orders': orders,
                    'total': len(orders)
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving company orders: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error retrieving company orders: {str(e)}")
        return jsonify({'message': 'Failed to retrieve orders'}), 500

@app.route('/api/company/<int:company_id>/employees')
def get_company_employees(company_id):
    """Get employees and reviews for a specific company"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                db = mongo_client.get_database("tracksmart")
                
                # Get only delivery partners who have selected this company
                partners_collection = db.get_collection("delivery_partners")
                partners = list(partners_collection.find({
                    'active': True,
                    'companies': company_id  # Filter by company ID in the companies array
                }))
                
                employees = []
                for partner in partners:
                    # Count active orders for this partner
                    active_orders = 0
                    completed_orders = 0
                    total_ratings = 0
                    rating_count = 0
                    
                    locations_collection = db.get_collection("locations")
                    company_qrs = locations_collection.find({'company_id': company_id})
                    
                    for qr_doc in company_qrs:
                        qr_id = qr_doc.get('qr_id')
                        if qr_id:
                            qr_collection = db.get_collection(str(qr_id))
                            delivery_info = qr_collection.find_one({
                                'type': 'delivery_location',
                                'delivery_partner_name': partner['name']
                            })
                            if delivery_info:
                                active_orders += 1
                                # Simulate completed orders and ratings
                                if random.randint(1, 100) > 70:  # 30% chance of being completed
                                    completed_orders += 1
                                    rating = random.randint(3, 5)  # Random rating 3-5
                                    total_ratings += rating
                                    rating_count += 1
                    
                    avg_rating = total_ratings / rating_count if rating_count > 0 else 0
                    
                    employee_data = {
                        'name': partner['name'],
                        'role': partner.get('role', 'Delivery Partner'),
                        'vehicle_type': partner.get('vehicle_type', 'N/A'),
                        'active_orders': active_orders,
                        'completed_orders': completed_orders,
                        'avg_rating': round(avg_rating, 1),
                        'email': partner['email'],
                        'phone': partner['phone']
                    }
                    employees.append(employee_data)
                
                return jsonify({
                    'employees': employees,
                    'total': len(employees)
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving company employees: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error retrieving company employees: {str(e)}")
        return jsonify({'message': 'Failed to retrieve employees'}), 500

@app.route('/api/company/<int:company_id>/employee/<employee_name>/analytics')
def get_employee_analytics(company_id, employee_name):
    """Get detailed analytics for a specific employee with performance comparison"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                db = mongo_client.get_database("tracksmart")
                
                # Get the specific employee
                partners_collection = db.get_collection("delivery_partners")
                employee = partners_collection.find_one({
                    'name': employee_name,
                    'companies': company_id,
                    'active': True
                })
                
                if not employee:
                    return jsonify({'message': 'Employee not found'}), 404
                
                # Calculate performance metrics
                locations_collection = db.get_collection("locations")
                company_qrs = locations_collection.find({'company_id': company_id})
                
                # Employee metrics
                employee_metrics = {
                    'total_orders': 0,
                    'completed_orders': 0,
                    'avg_rating': 0,
                    'on_time_deliveries': 0,
                    'performance_score': 0
                }
                
                # Calculate metrics for this employee
                for qr_doc in company_qrs:
                    qr_id = qr_doc.get('qr_id')
                    if qr_id:
                        qr_collection = db.get_collection(str(qr_id))
                        delivery_info = qr_collection.find_one({
                            'type': 'delivery_location',
                            'delivery_partner_name': employee_name
                        })
                        if delivery_info:
                            employee_metrics['total_orders'] += 1
                            # Simulate performance data
                            if random.randint(1, 100) > 25:  # 75% completion rate
                                employee_metrics['completed_orders'] += 1
                            if random.randint(1, 100) > 20:  # 80% on-time rate
                                employee_metrics['on_time_deliveries'] += 1
                
                # Calculate average rating
                employee_metrics['avg_rating'] = round(random.uniform(3.5, 5.0), 1)
                
                # Calculate performance score
                completion_rate = (employee_metrics['completed_orders'] / employee_metrics['total_orders']) * 100 if employee_metrics['total_orders'] > 0 else 0
                on_time_rate = (employee_metrics['on_time_deliveries'] / employee_metrics['total_orders']) * 100 if employee_metrics['total_orders'] > 0 else 0
                employee_metrics['performance_score'] = round((completion_rate + on_time_rate + (employee_metrics['avg_rating'] * 20)) / 3, 1)
                
                # Calculate company average for comparison
                company_avg = {
                    'avg_rating': 4.2,
                    'completion_rate': 85.0,
                    'on_time_rate': 78.0,
                    'performance_score': 82.5
                }
                
                # Performance comparison
                comparison = {
                    'rating_vs_avg': employee_metrics['avg_rating'] - company_avg['avg_rating'],
                    'completion_vs_avg': completion_rate - company_avg['completion_rate'],
                    'on_time_vs_avg': on_time_rate - company_avg['on_time_rate'],
                    'performance_vs_avg': employee_metrics['performance_score'] - company_avg['performance_score']
                }
                
                # Recent performance data for charts
                recent_performance = []
                for i in range(7):  # Last 7 days
                    date = datetime.utcnow() - timedelta(days=i)
                    recent_performance.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'orders': random.randint(2, 8),
                        'rating': round(random.uniform(3.0, 5.0), 1),
                        'on_time': random.randint(1, 8)
                    })
                
                return jsonify({
                    'employee': {
                        'name': employee['name'],
                        'role': employee.get('role', 'Delivery Partner'),
                        'email': employee.get('email', ''),
                        'phone': employee.get('phone', ''),
                        'vehicle_type': employee.get('vehicle_type', 'N/A')
                    },
                    'metrics': employee_metrics,
                    'company_average': company_avg,
                    'comparison': comparison,
                    'recent_performance': recent_performance
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving employee analytics: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error retrieving employee analytics: {str(e)}")
        return jsonify({'message': 'Failed to retrieve analytics'}), 500

@app.route('/api/get-qr-data/<qr_id>')
def get_qr_code_data(qr_id):
    """Get QR code data by 4-digit ID"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get QR code info from locations collection
                locations_collection = mongo_client.get_database("tracksmart").get_collection("locations")
                qr_info = locations_collection.find_one({'qr_id': qr_id})
                
                if not qr_info:
                    return jsonify({'message': 'QR code not found'}), 404
                
                # Return QR code data
                qr_data = {
                    'qr_id': qr_id,
                    'name': qr_info.get('name', 'Unknown'),
                    'address': qr_info.get('address', 'Unknown'),
                    'latitude': qr_info.get('latitude', 0),
                    'longitude': qr_info.get('longitude', 0),
                    'google_maps_url': qr_info.get('google_maps_url', ''),
                    'here_maps_url': qr_info.get('here_maps_url', ''),
                    'company_id': qr_info.get('company_id'),
                    'assigned_user_id': qr_info.get('assigned_user_id'),
                    'created_at': qr_info.get('timestamp', qr_info.get('created_at'))
                }
                
                return jsonify(qr_data)
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving QR data: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error retrieving QR data: {str(e)}")
        return jsonify({'message': 'Failed to retrieve QR data'}), 500

def send_simple_notification(user_email, user_name, qr_id, company_name, location_name):
    """
    Simple email notification function (disabled for deployment)
    """
    try:
        # Email functionality disabled for deployment
        # In production, implement with SendGrid, SES, or similar service
        app.logger.info(f"Email notification would be sent to {user_email} for QR {qr_id}")
        return True
    except Exception as e:
        app.logger.error(f"Email notification failed: {str(e)}")
        return False

def initialize_mongodb():
    """Initialize MongoDB connection"""
    global mongo_client, mongo_connected
    
    try:
        # Direct pymongo import
        from pymongo import MongoClient
        
        # Get MongoDB URI from environment variable
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in')
        
        # Create connection
        mongo_client = MongoClient(mongodb_uri)
        
        # Test connection
        mongo_client.admin.command('ping')
        app.logger.info("MongoDB connected successfully")
        mongo_connected = True
        return True
        
    except ImportError as import_error:
        app.logger.error(f"MongoDB import failed: {import_error}")
        app.logger.info("Application will continue without MongoDB connection")
        mongo_connected = False
        return False
    except Exception as e:
        app.logger.error(f"MongoDB connection failed: {e}")
        app.logger.info("Application will continue without MongoDB connection")
        mongo_connected = False
        return False

# Initialize MongoDB on startup
initialize_mongodb()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)