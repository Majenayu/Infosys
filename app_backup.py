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

# HERE Maps API keys for better reliability
HERE_API_KEYS = [
    "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI",
    "fdEwg_luXCC7NWAtXFnTWWZCuoMDHZDhCdnVM0cXZQE", 
    "KrksWbCEU3g3OnuQN3wDOncIgVTA2UrwIpTIN8iKzPQ"
]

# API endpoint to get available HERE Maps API keys
@app.route('/api/here-keys')
def get_here_keys():
    """Get HERE Maps API keys for frontend use"""
    return jsonify({'keys': HERE_API_KEYS})

# Routes
@app.route('/')
def index():
    """Main page with company registration form"""
    return render_template('index.html')

@app.route('/qr')
def qr_generator():
    """QR code generator page"""
    return render_template('qr.html')

@app.route('/scan')
def qr_scanner():
    """QR code scanner page"""
    return render_template('scan.html')

@app.route('/delivery')
def delivery_page():
    """Delivery partner login/register page"""
    return render_template('delivery.html')

@app.route('/register-company', methods=['POST'])
def register_company():
    """Register a new logistics company"""
    try:
        data = request.get_json()
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Validate required fields
        required_fields = ['name', 'contactPerson', 'email', 'phone', 'apiUrl', 'apiKey', 'address']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        # Check if company already exists
        db = mongo_client.get_database("tracksmart")
        companies_collection = db.get_collection("companies")
        
        existing_company = companies_collection.find_one({
            '$or': [
                {'email': data['email']},
                {'name': data['name']}
            ]
        })
        
        if existing_company:
            return jsonify({'message': 'Company with this name or email already exists'}), 400
        
        # Create new company document
        company_doc = {
            'name': data['name'],
            'contact_person': data['contactPerson'],
            'email': data['email'],
            'phone': data['phone'],
            'api_url': data['apiUrl'],
            'api_key': data['apiKey'],
            'address': data['address'],
            'created_at': datetime.utcnow()
        }
        
        # Insert company
        result = companies_collection.insert_one(company_doc)
        
        app.logger.info(f"Company registered: {data['name']} ({data['email']})")
        
        return jsonify({
            'message': 'Company registered successfully!',
            'company_id': str(result.inserted_id)
        })
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Registration failed'}), 500

@app.route('/store-location', methods=['POST'])
def store_location():
    """Store QR location data with unique 4-digit ID and create MongoDB collection"""
    try:
        data = request.get_json()
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Validate required fields
        if not all(key in data for key in ['name', 'address', 'latitude', 'longitude']):
            return jsonify({'message': 'Missing required location data'}), 400
        
        # Generate unique 4-digit ID
        db = mongo_client.get_database("tracksmart")
        locations_collection = db.get_collection("locations")
        
        qr_id = None
        max_attempts = 100
        
        for attempt in range(max_attempts):
            qr_id = random.randint(1000, 9999)
            
            # Check if this ID already exists
            existing_location = locations_collection.find_one({'qr_id': qr_id})
            if not existing_location:
                break
            
            if attempt == max_attempts - 1:
                return jsonify({'message': 'Unable to generate unique QR ID'}), 500
        
        # Create location document
        location_doc = {
            'qr_id': qr_id,
            'name': data['name'],
            'address': data['address'],
            'latitude': float(data['latitude']),
            'longitude': float(data['longitude']),
            'google_maps_url': data.get('google_maps_url', ''),
            'here_maps_url': data.get('here_maps_url', ''),
            'timestamp': datetime.utcnow(),
            'qr_generated': True
        }
        
        # Store in main locations collection
        locations_collection.insert_one(location_doc)
        
        # Create dedicated collection for this QR code
        qr_collection_name = str(qr_id)
        qr_collection = db.get_collection(qr_collection_name)
        
        # Store location data in QR-specific collection
        qr_collection.insert_one(location_doc)
        
        app.logger.info(f"Location stored with QR ID: {qr_id} - {data['name']}")
        
        return jsonify({
            'message': 'Location stored successfully!',
            'qr_id': qr_id,
            'location_id': str(location_doc['_id']) if '_id' in location_doc else None
        })
        
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/locations')
def get_locations():
    """Get all stored locations"""
    try:
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        locations_collection = db.get_collection("locations")
        
        locations = list(locations_collection.find({}, {'_id': 0}))
        
        return jsonify({'locations': locations})
        
    except Exception as e:
        app.logger.error(f"Error getting locations: {str(e)}")
        return jsonify({'message': 'Failed to get locations'}), 500

@app.route('/locations/<int:location_id>')
def get_location(location_id):
    """Get a specific location by ID"""
    try:
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        locations_collection = db.get_collection("locations")
        
        location = locations_collection.find_one({'qr_id': location_id}, {'_id': 0})
        
        if not location:
            return jsonify({'message': 'Location not found'}), 404
        
        return jsonify({'location': location})
        
    except Exception as e:
        app.logger.error(f"Error getting location: {str(e)}")
        return jsonify({'message': 'Failed to get location'}), 500

@app.route('/companies')
def get_companies():
    """Get all registered companies"""
    try:
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        companies_collection = db.get_collection("companies")
        
        companies = list(companies_collection.find({}, {'_id': 0, 'api_key': 0}))
        
        return jsonify({'companies': companies})
        
    except Exception as e:
        app.logger.error(f"Error getting companies: {str(e)}")
        return jsonify({'message': 'Failed to get companies'}), 500

@app.route('/store-live-location', methods=['POST'])
def store_live_location():
    """Store live location data in individual user collection"""
    try:
        data = request.get_json()
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Validate required fields
        required_fields = ['latitude', 'longitude', 'user_email']
        for field in required_fields:
            if field not in data:
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        # Store location data
        db = mongo_client.get_database("tracksmart")
        
        # Store in user-specific collection
        user_email = data['user_email'].lower()
        collection_name = f"delivery_{user_email.replace('@', '_').replace('.', '_')}"
        user_collection = db.get_collection(collection_name)
        
        location_doc = {
            'latitude': float(data['latitude']),
            'longitude': float(data['longitude']),
            'timestamp': datetime.utcnow(),
            'accuracy': data.get('accuracy', 0),
            'speed': data.get('speed', 0),
            'heading': data.get('heading', 0)
        }
        
        # Update existing location or create new one
        result = user_collection.replace_one(
            {'location_type': 'current'},
            {**location_doc, 'location_type': 'current'},
            upsert=True
        )
        
        # Also store in QR-specific collection if QR ID is provided
        if 'qr_id' in data:
            qr_collection_name = str(data['qr_id'])
            qr_collection = db.get_collection(qr_collection_name)
            
            qr_location_doc = {
                **location_doc,
                'user_email': user_email,
                'qr_id': data['qr_id'],
                'delivery_status': 'in_progress'
            }
            
            # Store location update in QR collection
            qr_collection.insert_one(qr_location_doc)
        
        app.logger.info(f"Live location stored for user: {user_email}")
        
        return jsonify({
            'message': 'Location stored successfully!',
            'collection': collection_name
        })
        
    except Exception as e:
        app.logger.error(f"Error storing live location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/live-locations')
def get_live_locations():
    """Get live location data"""
    try:
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        live_locations_collection = db.get_collection("live_locations")
        
        locations = list(live_locations_collection.find({}, {'_id': 0}))
        
        return jsonify({'locations': locations})
        
    except Exception as e:
        app.logger.error(f"Error getting live locations: {str(e)}")
        return jsonify({'message': 'Failed to get live locations'}), 500

@app.route('/delivery/register', methods=['POST'])
def delivery_register():
    """Register a new delivery partner"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'address', 'vehicleType', 'license', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'message': f'Missing required field: {field}'}), 400
        
        email = data['email'].lower()
        
        app.logger.info(f"Delivery partner registration attempt: {data['name']} ({email})")
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Check if partner already exists
                db = mongo_client.get_database("tracksmart")
                partners_collection = db.get_collection("delivery_partners")
                
                existing_partner = partners_collection.find_one({'email': email})
                if existing_partner:
                    return jsonify({'message': 'Email already registered'}), 400
                
                # Create delivery partner document
                delivery_partner = {
                    'name': data['name'],
                    'email': email,
                    'phone': data['phone'],
                    'address': data['address'],
                    'vehicle_type': data['vehicleType'],
                    'license': data['license'],
                    'password': data['password'],  # In production, hash this password
                    'created_at': datetime.utcnow(),
                    'active': True,
                    'deliveries': []
                }
                
                # Store in main delivery partners collection
                result = partners_collection.insert_one(delivery_partner)
                
                # Create individual collection for this delivery partner
                collection_name = f"delivery_{email.replace('@', '_').replace('.', '_')}"
                partner_collection = db.get_collection(collection_name)
                
                # Initialize collection with a placeholder document
                temp_doc = partner_collection.insert_one({'temp': 'placeholder'})
                partner_collection.delete_one({'_id': temp_doc.inserted_id})
                
                app.logger.info(f"Delivery partner registered: {data['name']} ({email}) - Collection: {collection_name}")
                
                return jsonify({
                    'message': 'Delivery partner registered successfully!',
                    'partner_id': str(result.inserted_id),
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
                db = mongo_client.get_database("tracksmart")
                partners_collection = db.get_collection("delivery_partners")
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

def initialize_mongodb():
    """Initialize MongoDB connection"""
    global mongo_client, mongo_connected
    
    try:
        # Clean approach to import pymongo
        import importlib
        
        # Try multiple approaches to avoid bson conflicts
        try:
            # Remove any existing problematic modules
            modules_to_remove = ['bson', 'bson.codec_options', 'bson.son']
            for mod in modules_to_remove:
                if mod in sys.modules:
                    del sys.modules[mod]
        except:
            pass
        
        # Import pymongo directly
        pymongo = importlib.import_module('pymongo')
        MongoClient = pymongo.MongoClient
        
        # Create connection
        mongo_client = MongoClient("mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in")
        
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

# Try to initialize MongoDB on startup
initialize_mongodb()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)