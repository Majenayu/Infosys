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
    """Main delivery partner portal page"""
    return render_template('delivery.html')

@app.route('/scan')
def qr_scanner():
    """QR code scanner page"""
    return render_template('scan.html')

@app.route('/api/companies')
def get_companies():
    """Get all registered companies"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                companies_collection = mongo_client.get_database("tracksmart").get_collection("companies")
                companies = list(companies_collection.find({}, {'password': 0}))  # Exclude passwords
                
                # Convert ObjectId to string for JSON serialization
                for company in companies:
                    company['_id'] = str(company['_id'])
                
                return jsonify(companies)
                
            except Exception as db_error:
                app.logger.error(f"Database error fetching companies: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot fetch companies")
            return jsonify({'message': 'Database connection failed'}), 500
    
    except Exception as e:
        app.logger.error(f"Error fetching companies: {str(e)}")
        return jsonify({'message': 'Failed to fetch companies'}), 500

@app.route('/api/activate-qr/<qr_id>', methods=['POST'])
def activate_qr(qr_id):
    """Activate QR code and create QR-specific collection when downloaded"""
    try:
        data = request.get_json()
        delivery_partner_name = data.get('delivery_partner_name', 'Unknown')
        user_email = data.get('user_email', 'unknown@example.com')
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                db = mongo_client.get_database("tracksmart")
                locations_collection = db.get_collection("locations")
                
                # Get QR code info from locations
                qr_info = locations_collection.find_one({'qr_id': qr_id})
                
                if not qr_info:
                    return jsonify({'message': 'QR code not found'}), 404
                
                # Create QR-specific collection
                qr_collection = db.get_collection(qr_id)
                
                # Store destination info as Coordinate A
                destination_doc = {
                    'type': 'destination_info',
                    'qr_id': qr_id,
                    'location_name': qr_info.get('name', 'Unknown'),
                    'address': qr_info.get('address', 'Unknown'),
                    'latitude': qr_info.get('latitude', 0),
                    'longitude': qr_info.get('longitude', 0),
                    'google_maps_url': qr_info.get('google_maps_url', ''),
                    'here_maps_url': qr_info.get('here_maps_url', ''),
                    'activated_at': datetime.utcnow(),
                    'activated_by': delivery_partner_name,
                    'user_email': user_email
                }
                
                # Store or update destination info
                qr_collection.update_one(
                    {'type': 'destination_info'},
                    {'$set': destination_doc},
                    upsert=True
                )
                
                app.logger.info(f"QR code {qr_id} activated successfully by {delivery_partner_name}")
                
                return jsonify({
                    'message': 'QR code activated successfully',
                    'qr_id': qr_id,
                    'destination': {
                        'name': destination_doc['location_name'],
                        'address': destination_doc['address'],
                        'coordinates': {
                            'latitude': destination_doc['latitude'],
                            'longitude': destination_doc['longitude']
                        }
                    }
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error activating QR: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error activating QR: {str(e)}")
        return jsonify({'message': 'Failed to activate QR'}), 500

@app.route('/api/store-live-location', methods=['POST'])
def store_live_location():
    """Store live location data - special handling for QR tracking"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['latitude', 'longitude', 'user_email']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        latitude = data['latitude']
        longitude = data['longitude']
        user_email = data['user_email']
        partner_name = data.get('delivery_partner_name', 'Unknown')
        qr_id = data.get('qr_id')  # QR ID for special tracking
        role_only = data.get('role_only', False)  # For aviation roles
        role = data.get('role', 'Boy')  # Default role
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        
        # Check if this is QR tracking mode
        if qr_id:
            try:
                qr_collection = db.get_collection(qr_id)
                
                # For aviation roles, store role information instead of coordinates
                if role_only and role in ['Captain', 'Pilot', 'TC']:
                    qr_location_doc = {
                        'type': 'delivery_location',
                        'qr_id': qr_id,
                        'user_email': user_email,
                        'delivery_partner_name': partner_name,
                        'role': role,
                        'location_type': 'role_only',
                        'status': 'BOARDED AND ARRIVING',
                        'timestamp': datetime.utcnow()
                    }
                else:
                    # Regular delivery partner with coordinates
                    qr_location_doc = {
                        'type': 'delivery_location',
                        'qr_id': qr_id,
                        'user_email': user_email,
                        'delivery_partner_name': partner_name,
                        'role': role,
                        'latitude': latitude,
                        'longitude': longitude,
                        'location_type': 'coordinates',
                        'timestamp': datetime.utcnow()
                    }
                
                # Store in QR collection (upsert based on user_email to keep only latest location)
                qr_collection.update_one(
                    {'type': 'delivery_location', 'user_email': user_email},
                    {'$set': qr_location_doc},
                    upsert=True
                )
                
                app.logger.info(f"QR tracking location stored in collection {qr_id} for {partner_name} ({user_email})")
                
                return jsonify({
                    'message': 'QR tracking location stored successfully',
                    'timestamp': datetime.utcnow().isoformat(),
                    'user_email': user_email,
                    'delivery_partner_name': partner_name,
                    'qr_id': qr_id,
                    'coordinate_type': 'B' if not role_only else 'role_only',
                    'tracking_mode': 'qr_only'
                })
                
            except Exception as qr_error:
                app.logger.error(f"Error storing QR tracking location: {str(qr_error)}")
                return jsonify({'message': 'Failed to store QR tracking location'}), 500
        
        else:
            # Normal location tracking - store in user's personal collection
            user_collection_name = f"delivery_{user_email.replace('@', '_at_').replace('.', '_dot_')}"
            user_collection = db.get_collection(user_collection_name)
            
            location_doc = {
                'user_email': user_email,
                'delivery_partner_name': partner_name,
                'latitude': latitude,
                'longitude': longitude,
                'timestamp': datetime.utcnow(),
                'tracking_mode': 'normal'
            }
            
            # Update existing location data or insert new one (upsert)
            user_collection.update_one(
                {'user_email': user_email},
                {'$set': location_doc},
                upsert=True
            )
            
            app.logger.info(f"Normal location stored for user {user_email}")
            
            return jsonify({
                'message': 'Location stored successfully',
                'timestamp': datetime.utcnow().isoformat(),
                'user_email': user_email,
                'tracking_mode': 'normal'
            })
        
    except Exception as e:
        app.logger.error(f"Error storing live location: {str(e)}")
        return jsonify({'message': 'Failed to store live location'}), 500

@app.route('/stop-qr-tracking', methods=['POST'])
def stop_qr_tracking():
    """Stop QR tracking when Done button pressed or someone else scans QR"""
    try:
        data = request.get_json()
        qr_id = data.get('qr_id')
        user_email = data.get('user_email')
        reason = data.get('reason', 'done_button')  # 'done_button' or 'other_scan'
        
        if not qr_id or not user_email:
            return jsonify({'message': 'QR ID and user email are required'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        qr_collection = db.get_collection(qr_id)
        
        # Update tracking status
        qr_collection.update_one(
            {'type': 'qr_info'},
            {'$set': {
                'tracking_active': False,
                'tracking_stopped_at': datetime.utcnow(),
                'tracking_stopped_by': user_email,
                'stop_reason': reason
            }}
        )
        
        app.logger.info(f"QR tracking stopped for {qr_id} by {user_email} - reason: {reason}")
        
        return jsonify({
            'message': 'QR tracking stopped successfully',
            'qr_id': qr_id,
            'reason': reason,
            'stopped_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Error stopping QR tracking: {str(e)}")
        return jsonify({'message': 'Failed to stop QR tracking'}), 500

@app.route('/delivery/register', methods=['POST'])
def delivery_register():
    """Register a new delivery partner"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'address', 'role', 'vehicleType', 'license', 'password']
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
                # Check if delivery partner already exists
                partners_collection = mongo_client.get_database("tracksmart").get_collection("delivery_partners")
                existing_partner = partners_collection.find_one({'email': email})
                
                if existing_partner:
                    return jsonify({'message': 'Email already registered'}), 400
                
                # Get selected companies
                selected_companies = data.get('companies', [])
                
                # Create delivery partner document
                partner = {
                    'name': data['name'],
                    'email': email,
                    'phone': data['phone'],
                    'address': data['address'],
                    'role': data['role'],
                    'vehicle_type': data['vehicleType'],
                    'license': data['license'],
                    'password': data['password'],  # In production, hash this password
                    'companies': selected_companies,
                    'created_at': datetime.utcnow(),
                    'active': True,
                    'deliveries': 0
                }
                
                # Store in delivery partners collection
                result = partners_collection.insert_one(partner)
                
                # Create individual collection for this delivery partner
                collection_name = f"delivery_{email.replace('@', '_at_').replace('.', '_dot_')}"
                individual_collection = mongo_client.get_database("tracksmart").get_collection(collection_name)
                
                # Insert a placeholder document to create the collection
                individual_collection.insert_one({
                    'collection_created_at': datetime.utcnow(),
                    'partner_email': email,
                    'partner_name': data['name'],
                    'status': 'active'
                })
                
                app.logger.info(f"Delivery partner registered: {data['name']} ({email})")
                
                return jsonify({
                    'message': 'Delivery partner registered successfully!',
                    'partner_id': str(result.inserted_id),
                    'name': data['name'],
                    'collection': collection_name
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during registration: {str(db_error)}")
                return jsonify({'message': 'Database error during registration'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot register delivery partner")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error registering delivery partner: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500

@app.route('/delivery/login', methods=['POST'])
def delivery_login():
    """Login delivery partner"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
        
        email = data['email'].lower()
        password = data['password']
        
        app.logger.info(f"Delivery partner login attempt: {email}")
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Find delivery partner in database
                partners_collection = mongo_client.get_database("tracksmart").get_collection("delivery_partners")
                partner = partners_collection.find_one({'email': email})
                
                if not partner:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check password (in production, use hashed passwords)
                if partner['password'] != password:
                    return jsonify({'message': 'Invalid email or password'}), 401
                
                # Check if partner is active
                if not partner.get('active', False):
                    return jsonify({'message': 'Account is deactivated'}), 401
                
                # Prepare user data for response
                user_data = {
                    'id': str(partner['_id']),
                    'name': partner['name'],
                    'email': partner['email'],
                    'phone': partner['phone'],
                    'vehicle_type': partner['vehicle_type'],
                    'license': partner['license'],
                    'role': partner.get('role', 'Boy'),
                    'active': partner['active']
                }
                
                collection_name = f"delivery_{email.replace('@', '_').replace('.', '_')}"
                
                app.logger.info(f"Delivery partner login successful: {partner['name']} ({email})")
                
                return jsonify({
                    'message': 'Login successful!',
                    'user': user_data,
                    'collection': collection_name
                })
                
            except Exception as db_error:
                app.logger.error(f"Database error during login: {str(db_error)}")
                return jsonify({'message': 'Database error during login'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot login delivery partner")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error logging in delivery partner: {str(e)}")
        return jsonify({'message': 'Login failed'}), 500

@app.route('/mark-delivered', methods=['POST'])
def mark_delivered():
    """Mark an order as delivered"""
    try:
        data = request.get_json()
        qr_id = data.get('qr_id')
        delivery_partner_name = data.get('delivery_partner_name')
        
        if not qr_id or not delivery_partner_name:
            return jsonify({'message': 'QR ID and delivery partner name are required'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            # Update the QR location in the main locations collection
            locations_collection = mongo_client.get_database("tracksmart").get_collection("locations")
            locations_collection.update_one(
                {'qr_id': qr_id},
                {'$set': {
                    'delivery_status': 'delivered',
                    'delivered_at': datetime.now(),
                    'delivery_partner': delivery_partner_name
                }}
            )
            
            app.logger.info(f"Order {qr_id} marked as delivered by {delivery_partner_name}")
            
            return jsonify({
                'message': 'Order marked as delivered successfully',
                'qr_id': qr_id,
                'status': 'delivered',
                'delivered_at': datetime.now().isoformat()
            }), 200
        else:
            return jsonify({'message': 'Database connection failed'}), 500
            
    except Exception as e:
        app.logger.error(f"Error marking order as delivered: {str(e)}")
        return jsonify({'message': 'Failed to mark order as delivered'}), 500

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