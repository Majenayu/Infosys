import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime
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
    """Main user portal page"""
    return render_template('user.html')

@app.route('/dashboard')
def user_dashboard():
    """User dashboard page"""
    return render_template('user_dashboard.html')

@app.route('/api/users')
def get_users():
    """Get all registered users"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                users = list(users_collection.find({}, {'password': 0}))  # Exclude passwords
                
                # Convert ObjectId to string for JSON serialization
                for user in users:
                    user['_id'] = str(user['_id'])
                
                return jsonify(users)
                
            except Exception as db_error:
                app.logger.error(f"Database error fetching users: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot fetch users")
            return jsonify({'message': 'Database connection failed'}), 500
    
    except Exception as e:
        app.logger.error(f"Error fetching users: {str(e)}")
        return jsonify({'message': 'Failed to fetch users'}), 500

@app.route('/api/qr-tracking/<qr_id>')
def get_qr_tracking_data(qr_id):
    """Get QR tracking data including delivery location if assigned"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                db = mongo_client.get_database("tracksmart")
                qr_collection = db.get_collection(qr_id)
                
                # Get destination info (Coordinate A)
                destination_info = qr_collection.find_one({'type': 'destination_info'})
                if not destination_info:
                    destination_info = qr_collection.find_one({'type': 'qr_info'})
                
                # Get latest delivery location (Coordinate B)
                delivery_info = qr_collection.find_one(
                    {'type': 'delivery_location'}, 
                    sort=[('timestamp', -1)]
                )
                
                if not destination_info:
                    return jsonify({'message': 'QR code not found'}), 404
                
                response_data = {
                    'qr_id': qr_id,
                    'destination': {
                        'name': destination_info.get('location_name', 'Unknown'),
                        'address': destination_info.get('address', 'Unknown'),
                        'coordinates': {
                            'latitude': destination_info.get('latitude', 0),
                            'longitude': destination_info.get('longitude', 0)
                        }
                    },
                    'delivery_partner': None,
                    'status': 'pending'
                }
                
                if delivery_info:
                    # Check if it's a role-only entry (aviation roles)
                    if delivery_info.get('location_type') == 'role_only':
                        response_data['delivery_partner'] = {
                            'name': delivery_info.get('delivery_partner_name', 'Unknown'),
                            'role': delivery_info.get('role', 'Unknown'),
                            'status': 'BOARDED AND ARRIVING'
                        }
                        response_data['status'] = 'in_transit_aviation'
                    else:
                        response_data['delivery_partner'] = {
                            'name': delivery_info.get('delivery_partner_name', 'Unknown'),
                            'coordinates': {
                                'latitude': delivery_info.get('latitude', 0),
                                'longitude': delivery_info.get('longitude', 0)
                            },
                            'last_updated': delivery_info.get('timestamp', datetime.utcnow()).isoformat()
                        }
                        response_data['status'] = 'in_progress'
                
                return jsonify(response_data)
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving QR tracking: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error retrieving QR tracking data: {str(e)}")
        return jsonify({'message': 'Failed to retrieve tracking data'}), 500

@app.route('/api/check-qr-access/<qr_id>/<user_id>')
def check_qr_access(qr_id, user_id):
    """Check if a user has access to a specific QR code"""
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
                    return jsonify({'message': 'QR code not found', 'access': False}), 404
                
                assigned_user_id = qr_info.get('assigned_user_id')
                company_id = qr_info.get('company_id')
                
                # Convert user_id to int for comparison
                try:
                    user_id_int = int(user_id)
                except ValueError:
                    return jsonify({'message': 'Invalid user ID format', 'access': False}), 400
                
                # Allow access if user is assigned to this QR code
                if assigned_user_id and assigned_user_id == user_id_int:
                    return jsonify({
                        'access': True,
                        'message': 'Access granted',
                        'qr_id': qr_id,
                        'assigned_user_id': assigned_user_id,
                        'company_id': company_id
                    })
                
                # Deny access for unassigned users
                return jsonify({
                    'access': False,
                    'message': 'Access denied. This QR code is assigned to another user.',
                    'qr_id': qr_id,
                    'assigned_user_id': assigned_user_id
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error checking QR access: {str(db_error)}")
                return jsonify({'message': 'Database error', 'access': False}), 500
        else:
            return jsonify({'message': 'Database connection failed', 'access': False}), 500
            
    except Exception as e:
        app.logger.error(f"Error checking QR access: {str(e)}")
        return jsonify({'message': 'Failed to check QR access', 'access': False}), 500

@app.route('/user/register', methods=['POST'])
def user_register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'address', 'password']
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
                # Check if user already exists
                users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                existing_user = users_collection.find_one({'email': email})
                
                if existing_user:
                    return jsonify({'message': 'Email already registered'}), 400
                
                # Generate unique user ID starting from 1000
                highest_id_user = users_collection.find_one(
                    {},
                    sort=[('user_id', -1)]
                )
                
                if highest_id_user and 'user_id' in highest_id_user:
                    user_id = highest_id_user['user_id'] + 1
                else:
                    user_id = 1000
                
                # Create user document
                user = {
                    'user_id': user_id,
                    'name': data['name'],
                    'email': email,
                    'phone': data['phone'],
                    'address': data['address'],
                    'password': data['password'],  # In production, hash this password
                    'created_at': datetime.utcnow(),
                    'active': True,
                    'tracking_history': []
                }
                
                # Store in users collection
                result = users_collection.insert_one(user)
                
                app.logger.info(f"User registered: {data['name']} ({email})")
                
                return jsonify({
                    'message': 'User registered successfully!',
                    'user_id': user_id,
                    'name': data['name']
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during user registration: {str(db_error)}")
                return jsonify({'message': 'Database error during registration'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot register user")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error registering user: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500

@app.route('/user/login', methods=['POST'])
def user_login():
    """Login user"""
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
                # Find user in database
                users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                user = users_collection.find_one({'email': email})
                
                if not user:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check password (in production, use hashed passwords)
                if user['password'] != password:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check if user is active
                if not user.get('active', False):
                    return jsonify({'message': 'Account is deactivated'}), 401
                
                # Prepare user data for response
                user_data = {
                    'user_id': user['user_id'],
                    'name': user['name'],
                    'email': user['email'],
                    'phone': user['phone'],
                    'address': user['address'],
                    'active': user['active']
                }
                
                app.logger.info(f"User login successful: {user['name']} ({email})")
                
                return jsonify({
                    'message': 'Login successful!',
                    'user': user_data
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during login: {str(db_error)}")
                return jsonify({'message': 'Database error during login'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot login user")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error logging in user: {str(e)}")
        return jsonify({'message': 'Login failed'}), 500

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