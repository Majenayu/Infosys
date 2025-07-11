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
    "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI",
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

@app.route('/user')
def user_page():
    """User login/register page"""
    return render_template('user.html')

@app.route('/user/dashboard')
def user_dashboard():
    """User dashboard page"""
    return render_template('user_dashboard.html')

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
        
        # Create company document
        company_doc = {
            'name': data['name'],
            'contact_person': data['contactPerson'],
            'email': data['email'],
            'phone': data['phone'],
            'api_url': data['apiUrl'],
            'api_key': data['apiKey'],
            'address': data['address'],
            'created_at': datetime.utcnow(),
            'status': 'active'
        }
        
        # Insert into companies collection
        result = companies_collection.insert_one(company_doc)
        
        app.logger.info(f"Company registered: {data['name']} ({data['email']})")
        
        return jsonify({
            'message': 'Company registered successfully!',
            'company_id': str(result.inserted_id),
            'name': data['name']
        })
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Failed to register company'}), 500

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
        
        # Generate unique 4-digit ID
        import random
        qr_id = str(random.randint(1000, 9999))
        
        # Check if this ID already exists and generate new one if needed
        db = mongo_client.get_database("tracksmart")
        attempts = 0
        while attempts < 10:  # Prevent infinite loop
            if qr_id not in db.list_collection_names():
                break
            qr_id = str(random.randint(1000, 9999))
            attempts += 1
        
        # Store location data in locations collection
        location_doc = {
            'qr_id': qr_id,
            'name': data.get('name', ''),
            'address': data.get('address', ''),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'google_maps_url': data.get('google_maps_url', ''),
            'here_maps_url': data.get('here_maps_url', ''),
            'timestamp': datetime.utcnow(),
            'qr_generated': True
        }
        
        # Insert into locations collection
        locations_collection = db.get_collection("locations")
        result = locations_collection.insert_one(location_doc)
        
        # Create new collection with the 4-digit ID name
        qr_collection = db.get_collection(qr_id)
        
        # Insert initial document in the new collection
        qr_collection.insert_one({
            'type': 'qr_info',
            'qr_id': qr_id,
            'location_name': data.get('name', ''),
            'address': data.get('address', ''),
            'coordinates': {
                'latitude': data.get('latitude'),
                'longitude': data.get('longitude')
            },
            'created_at': datetime.utcnow(),
            'status': 'active'
        })
        
        app.logger.info(f"QR location stored with ID {qr_id}: {data.get('name', 'Unknown')}")
        
        return jsonify({
            'message': 'Location data stored successfully!',
            'qr_id': qr_id,
            'location_id': str(result.inserted_id),
            'collection_created': qr_id
        })
        
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/locations')
def get_locations():
    """Get all stored locations"""
    try:
        # Return empty list for now
        return jsonify([])
        
    except Exception as e:
        app.logger.error(f"Error fetching locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch locations'}), 500

@app.route('/location/<location_id>')
def get_location(location_id):
    """Get a specific location by ID"""
    try:
        # Return not found for now
        return jsonify({'message': 'Location not found'}), 404
        
    except Exception as e:
        app.logger.error(f"Error fetching location: {str(e)}")
        return jsonify({'message': 'Failed to fetch location'}), 500

@app.route('/companies')
def get_companies():
    """Get all registered companies"""
    try:
        # Return empty list for now
        return jsonify([])
        
    except Exception as e:
        app.logger.error(f"Error fetching companies: {str(e)}")
        return jsonify({'message': 'Failed to fetch companies'}), 500

@app.route('/store-live-location', methods=['POST'])
def store_live_location():
    """Store live location data in individual user collection"""
    try:
        data = request.get_json()
        
        # Get user email from the request (check both keys for compatibility)
        user_email = data.get('user_email') or data.get('email')
        app.logger.info(f"Store live location request - user_email: {user_email}, data: {data}")
        
        if not user_email:
            app.logger.error("User email is missing from request")
            return jsonify({'message': 'User email is required'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Get user's individual collection
        user_collection_name = f"delivery_{user_email.replace('@', '_at_').replace('.', '_dot_')}"
        user_collection = mongo_client.get_database("tracksmart").get_collection(user_collection_name)
        
        # Check if QR ID is provided for specific QR collection tracking
        qr_id = data.get('qr_id')
        
        # Create location document to update/insert
        location_doc = {
            'latitude': data['latitude'],
            'longitude': data['longitude'],
            'timestamp': datetime.utcnow(),
            'type': 'current_location',
            'user_email': user_email
        }
        
        # Store in QR-specific collection if QR ID is provided
        if qr_id:
            # Update or insert in the QR-specific collection (only keep one current location per user)
            qr_collection = mongo_client.get_database("tracksmart").get_collection(qr_id)
            qr_location_doc = {
                'latitude': data['latitude'],
                'longitude': data['longitude'],
                'timestamp': datetime.utcnow(),
                'type': 'delivery_location',
                'user_email': user_email,
                'qr_id': qr_id
            }
            qr_collection.update_one(
                {'user_email': user_email, 'type': 'delivery_location'},
                {'$set': qr_location_doc},
                upsert=True
            )
        
        # Update or insert the current location (only keep one current location record)
        result = user_collection.update_one(
            {'type': 'current_location'},
            {'$set': location_doc},
            upsert=True
        )
        
        app.logger.info(f"Live location updated for user {user_email}: {data['latitude']}, {data['longitude']}")
        
        return jsonify({
            'message': 'Live location updated successfully!',
            'updated': result.modified_count > 0 or result.upserted_id is not None
        })
        
    except Exception as e:
        app.logger.error(f"Error storing live location: {str(e)}")
        return jsonify({'message': 'Failed to store live location'}), 500

@app.route('/live-locations')
def get_live_locations():
    """Get live location data"""
    try:
        # Return empty list for now
        return jsonify([])
        
    except Exception as e:
        app.logger.error(f"Error fetching live locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch live locations'}), 500

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
                
                # Create individual collection for this delivery partner (empty collection)
                collection_name = f"delivery_{email.replace('@', '_').replace('.', '_')}"
                partner_collection = mongo_client.get_database("tracksmart").get_collection(collection_name)
                
                # Just create the collection by inserting a placeholder document and then removing it
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
                
                # Create user document
                user = {
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
                    'user_id': str(result.inserted_id)
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
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
        
        email = data['email'].lower()
        password = data['password']
        
        app.logger.info(f"User login attempt: {email}")
        
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
                    'id': str(user['_id']),
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
                app.logger.error(f"Database error during user login: {str(db_error)}")
                return jsonify({'message': 'Database error during login'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot login user")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error logging in user: {str(e)}")
        return jsonify({'message': 'Login failed'}), 500

@app.route('/api/qr-code/<qr_id>')
def get_qr_code_data(qr_id):
    """Get QR code data by 4-digit ID"""
    try:
        if not qr_id or len(qr_id) != 4 or not qr_id.isdigit():
            return jsonify({'message': 'Invalid QR code format. Must be 4 digits.'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Look for QR code in the specific collection named after the QR ID
                qr_collection = mongo_client.get_database("tracksmart").get_collection(qr_id)
                qr_data = qr_collection.find_one({'type': 'qr_info'})
                
                if not qr_data:
                    return jsonify({'message': 'QR code not found'}), 404
                
                # Return QR code information
                response_data = {
                    'qr_id': qr_data.get('qr_id', qr_id),
                    'location_name': qr_data.get('location_name', ''),
                    'address': qr_data.get('address', ''),
                    'coordinates': qr_data.get('coordinates', {}),
                    'created_at': qr_data.get('created_at'),
                    'status': qr_data.get('status', 'active')
                }
                
                app.logger.info(f"QR code data retrieved for ID: {qr_id}")
                
                return jsonify(response_data)
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving QR code {qr_id}: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot retrieve QR code data")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error retrieving QR code data: {str(e)}")
        return jsonify({'message': 'Failed to retrieve QR code data'}), 500

# Initialize MongoDB connection after app is created
def initialize_mongodb():
    """Initialize MongoDB connection"""
    global mongo_client, mongo_connected
    
    try:
        # Clean approach to avoid bson conflicts
        import importlib
        import sys
        
        # Remove any problematic bson modules from cache
        modules_to_clear = [k for k in sys.modules.keys() if k.startswith('bson') and k != 'bson']
        for mod in modules_to_clear:
            try:
                del sys.modules[mod]
            except KeyError:
                pass
        
        # Import pymongo directly using importlib
        pymongo = importlib.import_module('pymongo')
        MongoClient = getattr(pymongo, 'MongoClient')
        
        # Create connection
        mongo_client = MongoClient("mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in")
        
        # Test connection
        mongo_client.admin.command('ping')
        app.logger.info(f"MongoDB connected successfully with PyMongo {pymongo.version}")
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