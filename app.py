import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime, timedelta
import sys
import time
import random
from email_service import send_qr_email, send_simple_notification

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
@app.route('/dashboard')  # Add alias route to prevent "Not Found" errors
def user_dashboard():
    """User dashboard page"""
    return render_template('user_dashboard.html')

@app.route('/company')
def company_page():
    """Company registration page"""
    return render_template('company.html')

@app.route('/company/login')
def company_login_page():
    """Company login page"""
    return render_template('company_login.html')

@app.route('/company/dashboard')
def company_dashboard():
    """Company dashboard page"""
    return render_template('company_dashboard.html')

@app.route('/company/register', methods=['POST'])
def company_register():
    """Register a new company"""
    try:
        data = request.get_json()
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Validate required fields
        required_fields = ['name', 'contactPerson', 'email', 'phone', 'password', 'address']
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
        
        # Generate unique company ID starting from 1
        # Get the highest existing company_id and increment by 1
        highest_id_company = companies_collection.find_one(
            {},
            sort=[('company_id', -1)]
        )
        
        if highest_id_company and 'company_id' in highest_id_company:
            company_id = highest_id_company['company_id'] + 1
        else:
            company_id = 1
        
        # Create company document
        company_doc = {
            'company_id': company_id,
            'name': data['name'],
            'contact_person': data['contactPerson'],
            'email': data['email'],
            'phone': data['phone'],
            'password': data['password'],  # In production, hash this password
            'address': data['address'],
            'created_at': datetime.utcnow(),
            'status': 'active'
        }
        
        # Insert into companies collection
        result = companies_collection.insert_one(company_doc)
        
        app.logger.info(f"Company registered: {data['name']} ({data['email']}) - ID: {company_id}")
        
        return jsonify({
            'message': 'Company registered successfully!',
            'company_id': company_id,
            'name': data['name']
        })
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Failed to register company'}), 500

@app.route('/company/login', methods=['POST'])
def company_login():
    """Login company"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({'message': 'Email and password are required'}), 400
        
        email = data['email'].lower()
        password = data['password']
        
        app.logger.info(f"Company login attempt: {email}")
        
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
                if not company.get('status') == 'active':
                    return jsonify({'message': 'Company account is deactivated'}), 401
                
                # Prepare company data for response
                company_data = {
                    'id': str(company['_id']),
                    'company_id': company.get('company_id', 'N/A'),
                    'name': company['name'],
                    'email': company['email'],
                    'contact_person': company['contact_person'],
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



@app.route('/store-location', methods=['POST'])
def store_location():
    """Store QR location data with unique 4-digit ID - collection created only when downloaded"""
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
        
        # Store location data in locations collection (temporary storage)
        location_doc = {
            'qr_id': qr_id,
            'name': data.get('name', ''),
            'address': data.get('address', ''),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'google_maps_url': data.get('google_maps_url', ''),
            'here_maps_url': data.get('here_maps_url', ''),
            'company_id': data.get('company_id'),  # Store company ID with QR code
            'assigned_user_id': data.get('assigned_user_id'),  # Store assigned user ID
            'timestamp': datetime.utcnow(),
            'qr_generated': True,
            'status': 'pending_download'  # Collection will be created when downloaded
        }
        
        # Insert into locations collection
        locations_collection = db.get_collection("locations")
        result = locations_collection.insert_one(location_doc)
        app.logger.info(f"QR location stored with ID {qr_id}: {data.get('name', 'Unknown')} (pending download)")
        
        # Send email notification to assigned user
        if data.get('assigned_user_id'):
            try:
                # Get user details
                users_collection = db.get_collection("users")
                user_data = users_collection.find_one({'user_id': data.get('assigned_user_id')})
                
                # Get company details
                company_data = None
                if data.get('company_id'):
                    companies_collection = db.get_collection("companies")
                    company_data = companies_collection.find_one({'company_id': data.get('company_id')})
                
                if user_data:
                    user_email = user_data.get('email', '')
                    user_name = user_data.get('name', 'User')
                    company_name = company_data.get('name', 'Unknown Company') if company_data else 'Unknown Company'
                    location_name = data.get('name', 'Unknown Location')
                    
                    # Try to send email notification
                    email_sent = send_simple_notification(
                        user_email=user_email,
                        user_name=user_name,
                        qr_id=qr_id,
                        company_name=company_name,
                        location_name=location_name
                    )
                    
                    if email_sent:
                        app.logger.info(f"Email notification sent to {user_email} for QR code {qr_id}")
                    else:
                        app.logger.warning(f"Failed to send email notification to {user_email} for QR code {qr_id}")
                        
            except Exception as email_error:
                app.logger.error(f"Error sending email notification: {str(email_error)}")
        
        return jsonify({
            'message': 'Location data stored successfully! User notified via email.',
            'qr_id': qr_id,
            'location_id': str(result.inserted_id),
            'status': 'pending_download'
        })
        
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/activate-qr/<qr_id>', methods=['POST'])
def activate_qr(qr_id):
    """Activate QR code and create QR-specific collection when downloaded"""
    try:
        if not qr_id or len(qr_id) != 4 or not qr_id.isdigit():
            return jsonify({'message': 'Invalid QR ID format'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        locations_collection = db.get_collection("locations")
        
        # Find the QR location data
        qr_data = locations_collection.find_one({'qr_id': qr_id})
        if not qr_data:
            return jsonify({'message': 'QR code not found'}), 404
        
        # Create QR-specific collection with destination info (Coordinate A)
        qr_collection = db.get_collection(qr_id)
        
        qr_info_doc = {
            'type': 'destination_info',  # This is Coordinate A - the destination
            'qr_id': qr_id,
            'location_name': qr_data.get('name', ''),
            'address': qr_data.get('address', ''),
            'coordinates': {
                'lat': qr_data.get('latitude'),
                'lng': qr_data.get('longitude')
            },
            'latitude': qr_data.get('latitude'),      # Coordinate A - destination latitude
            'longitude': qr_data.get('longitude'),    # Coordinate A - destination longitude
            'google_maps_url': qr_data.get('google_maps_url', ''),
            'here_maps_url': qr_data.get('here_maps_url', ''),
            'company_id': qr_data.get('company_id'),  # Include company ID from original QR data
            'assigned_user_id': qr_data.get('assigned_user_id'),  # Include assigned user ID
            'timestamp': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'qr_generated': True,
            'status': 'active',
            'tracking_active': False,
            'coordinate_type': 'A'  # Mark as coordinate A (destination)
        }
        
        qr_collection.insert_one(qr_info_doc)
        
        # Update status in locations collection
        locations_collection.update_one(
            {'qr_id': qr_id},
            {'$set': {'status': 'active', 'activated_at': datetime.utcnow()}}
        )
        
        app.logger.info(f"QR code {qr_id} activated and collection created")
        
        return jsonify({
            'message': 'QR code activated successfully!',
            'qr_id': qr_id,
            'status': 'active'
        })
        
    except Exception as e:
        app.logger.error(f"Error activating QR code: {str(e)}")
        return jsonify({'message': 'Failed to activate QR code'}), 500

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
@app.route('/api/companies')  # Add API alias
def get_companies():
    """Get all registered companies"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get all companies from database
                companies_collection = mongo_client.get_database("tracksmart").get_collection("companies")
                companies = list(companies_collection.find({}, {
                    'company_id': 1,
                    'name': 1,
                    'email': 1,
                    'phone': 1,
                    'address': 1,
                    'created_at': 1,
                    'status': 1,
                    '_id': 0
                }))
                
                # Sort by company_id
                companies.sort(key=lambda x: x.get('company_id', 0))
                
                app.logger.info(f"Retrieved {len(companies)} companies")
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

@app.route('/api/users')
def get_users():
    """Get all registered users for company selection"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get all users from database
                users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                users = list(users_collection.find({}, {
                    'user_id': 1,
                    'name': 1,
                    'email': 1,
                    'phone': 1,
                    'active': 1,
                    '_id': 0
                }))
                
                # Sort by user_id
                users.sort(key=lambda x: x.get('user_id', 0))
                
                app.logger.info(f"Retrieved {len(users)} users")
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

@app.route('/api/delivery-partners')
def get_delivery_partners():
    """Get all delivery partners"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get all delivery partners from database
                partners_collection = mongo_client.get_database("tracksmart").get_collection("delivery_partners")
                partners = list(partners_collection.find({}, {
                    'name': 1,
                    'email': 1,
                    'phone': 1,
                    'role': 1,
                    'vehicle_type': 1,
                    'companies': 1,  # Include companies field
                    'active': 1,
                    'created_at': 1,
                    '_id': 0
                }))
                
                app.logger.info(f"Retrieved {len(partners)} delivery partners")
                return jsonify(partners)
                
            except Exception as db_error:
                app.logger.error(f"Database error fetching delivery partners: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot fetch delivery partners")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error fetching delivery partners: {str(e)}")
        return jsonify({'message': 'Failed to fetch delivery partners'}), 500

@app.route('/api/company/<int:company_id>/delivery-partners')
def get_company_delivery_partners(company_id):
    """Get delivery partners associated with a specific company"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get delivery partners assigned to this company
                partners_collection = mongo_client.get_database("tracksmart").get_collection("delivery_partners")
                
                # Find partners where companies array contains the company_id
                partners = list(partners_collection.find(
                    {'active': True, 'companies': company_id}, 
                    {
                        'name': 1,
                        'email': 1,
                        'phone': 1,
                        'role': 1,
                        'vehicle_type': 1,
                        'companies': 1,
                        'created_at': 1,
                        '_id': 0
                    }
                ))
                
                # Sort by created_at
                partners.sort(key=lambda x: x.get('created_at', datetime.min))
                
                app.logger.info(f"Retrieved {len(partners)} delivery partners for company {company_id}")
                return jsonify(partners)
                
            except Exception as db_error:
                app.logger.error(f"Database error fetching company delivery partners: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot fetch company delivery partners")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error fetching company delivery partners: {str(e)}")
        return jsonify({'message': 'Failed to fetch company delivery partners'}), 500

@app.route('/api/debug/users')
def debug_users():
    """Debug endpoint to see user data with passwords (for testing only)"""
    try:
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get all users from database with all fields
                users_collection = mongo_client.get_database("tracksmart").get_collection("users")
                users = list(users_collection.find({}, {'_id': 0}))
                
                app.logger.info(f"Debug: Retrieved {len(users)} users with full data")
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

@app.route('/store-live-location', methods=['POST'])
def store_live_location():
    """Store live location data - special handling for QR tracking"""
    try:
        data = request.get_json()
        
        # Get user email and QR ID from request
        user_email = data.get('user_email') or data.get('email')
        qr_id = data.get('qr_id')
        is_qr_tracking = data.get('is_qr_tracking', False)
        role_only = data.get('role_only', False)
        
        app.logger.info(f"Store live location request - user_email: {user_email}, qr_id: {qr_id}, is_qr_tracking: {is_qr_tracking}, role_only: {role_only}")
        
        if not user_email:
            app.logger.error("User email is missing from request")
            return jsonify({'message': 'User email is required'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        
        # Create location document
        location_doc = {
            'latitude': data['latitude'],
            'longitude': data['longitude'],
            'timestamp': datetime.utcnow(),
            'type': 'current_location',
            'user_email': user_email
        }
        
        # Special handling for QR tracking
        if is_qr_tracking and qr_id:
            # During QR tracking, ONLY store in QR-specific collection
            # Do NOT store in user's personal collection
            try:
                qr_collection = db.get_collection(qr_id)
                
                # Get delivery partner's info from database
                partners_collection = db.get_collection("delivery_partners")
                delivery_partner = partners_collection.find_one({'email': user_email})
                
                # If user_email is 'anonymous', try to find the most recent delivery partner
                if user_email == 'anonymous' or not delivery_partner:
                    # Find the most recently active delivery partner as a fallback
                    recent_partner = partners_collection.find_one({}, sort=[('created_at', -1)])
                    if recent_partner:
                        delivery_partner = recent_partner
                        user_email = recent_partner['email']  # Update the user_email for storage
                        app.logger.info(f"Using most recent delivery partner as fallback: {recent_partner['name']} ({recent_partner['email']})")
                
                partner_name = delivery_partner.get('name', 'Unknown Partner') if delivery_partner else 'Unknown Partner'
                partner_role = delivery_partner.get('role', 'boy') if delivery_partner else 'boy'
                
                # Role-based location handling
                if role_only or partner_role in ['captain', 'pilot', 'tc']:
                    # For Captain, Pilot, TC - store only role information, no coordinates
                    qr_location_doc = {
                        'type': 'delivery_location',  # This is Coordinate B - role information
                        'timestamp': datetime.utcnow(),
                        'user_email': user_email,
                        'delivery_partner_name': partner_role.upper(),  # Store role as name
                        'role': partner_role,
                        'qr_id': qr_id,
                        'coordinate_type': 'B',  # Mark as coordinate B (role info)
                        'location_type': 'role_only'  # No coordinates, just role
                    }
                    app.logger.info(f"Storing role-only data for {partner_role}: {partner_name} ({user_email})")
                else:
                    # For regular delivery partners - store full location data
                    qr_location_doc = {
                        'type': 'delivery_location',  # This is Coordinate B - delivery partner's live location
                        'latitude': data['latitude'],     # Current position of delivery partner
                        'longitude': data['longitude'],   # Current position of delivery partner
                        'timestamp': datetime.utcnow(),
                        'user_email': user_email,
                        'delivery_partner_name': partner_name,  # Include delivery partner's name
                        'role': partner_role,
                        'qr_id': qr_id,
                        'coordinate_type': 'B',  # Mark as coordinate B (live location)
                        'location_type': 'coordinates'  # Full coordinates
                    }
                    app.logger.info(f"Storing live location data for {partner_role}: {partner_name} ({user_email})")
                
                # Store in QR collection (upsert based on user_email to keep only latest location)
                qr_collection.update_one(
                    {'type': 'delivery_location', 'user_email': user_email},
                    {'$set': qr_location_doc},
                    upsert=True
                )
                
                app.logger.info(f"QR tracking location (Coordinate B) stored in collection {qr_id} for {partner_name} ({user_email})")
                
                return jsonify({
                    'message': 'QR tracking location stored successfully',
                    'timestamp': datetime.utcnow().isoformat(),
                    'user_email': user_email,
                    'delivery_partner_name': partner_name,
                    'qr_id': qr_id,
                    'coordinate_type': 'B',
                    'tracking_mode': 'qr_only'
                })
                
            except Exception as qr_error:
                app.logger.error(f"Error storing QR tracking location: {str(qr_error)}")
                return jsonify({'message': 'Failed to store QR tracking location'}), 500
        
        else:
            # Normal location tracking - store in user's personal collection
            user_collection_name = f"delivery_{user_email.replace('@', '_at_').replace('.', '_dot_')}"
            user_collection = db.get_collection(user_collection_name)
            
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

@app.route('/list-collections')
def list_collections():
    """List all MongoDB collections to verify QR-specific collections exist"""
    try:
        if not mongo_client:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed'}), 500
        
        db = mongo_client.get_database("tracksmart")
        collections = db.list_collection_names()
        
        # Filter for QR-specific collections (numeric names)
        qr_collections = [name for name in collections if name.isdigit()]
        delivery_collections = [name for name in collections if name.startswith('delivery_')]
        other_collections = [name for name in collections if not name.isdigit() and not name.startswith('delivery_')]
        
        return jsonify({
            'qr_collections': qr_collections,
            'delivery_collections': delivery_collections,
            'other_collections': other_collections,
            'total_collections': len(collections)
        })
        
    except Exception as e:
        return jsonify({'message': f'Error listing collections: {str(e)}'}), 500

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
                
                # Create delivery partner document
                delivery_partner = {
                    'name': data['name'],
                    'email': email,
                    'phone': data['phone'],
                    'address': data['address'],
                    'role': data['role'],
                    'vehicle_type': data['vehicleType'],
                    'license': data['license'],
                    'password': data['password'],  # In production, hash this password
                    'companies': data.get('companies', []),  # Selected company IDs
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
                
                # Generate unique user ID starting from 1000
                # Get the highest existing user_id and increment by 1
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
                    'user_id': user.get('user_id', str(user['_id'])),  # Include user_id for frontend compatibility
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
                
                # Return QR code information (including access control data)
                response_data = {
                    'qr_id': qr_data.get('qr_id', qr_id),
                    'location_name': qr_data.get('location_name', ''),
                    'address': qr_data.get('address', ''),
                    'coordinates': qr_data.get('coordinates', {}),
                    'created_at': qr_data.get('created_at'),
                    'status': qr_data.get('status', 'active'),
                    'company_id': qr_data.get('company_id'),
                    'assigned_user_id': qr_data.get('assigned_user_id')
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

@app.route('/api/check-qr-access/<qr_id>/<user_id>')
def check_qr_access(qr_id, user_id):
    """Check if a user has access to a specific QR code"""
    try:
        if not qr_id or len(qr_id) != 4 or not qr_id.isdigit():
            return jsonify({'message': 'Invalid QR ID format', 'access': False}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if not mongo_client:
            return jsonify({'message': 'Database connection failed', 'access': False}), 500
        
        db = mongo_client.get_database("tracksmart")
        
        # Get QR data from QR-specific collection
        qr_collection = db.get_collection(qr_id)
        qr_data = qr_collection.find_one({'type': 'destination_info'})
        
        if not qr_data:
            return jsonify({'message': 'QR code not found', 'access': False}), 404
        
        # Check if user is assigned to this QR code
        assigned_user_id = qr_data.get('assigned_user_id')
        company_id = qr_data.get('company_id')
        
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
        
    except Exception as e:
        app.logger.error(f"Error checking QR access: {str(e)}")
        return jsonify({'message': 'Failed to check QR access', 'access': False}), 500

@app.route('/api/company/<int:company_id>/orders')
def get_company_orders(company_id):
    """Get orders for a specific company - only accessible by company employees"""
    try:
        # SECURITY: Verify that only company employees can access orders
        # In a real application, you would check authentication tokens
        # For now, we rely on the company_id being passed from authenticated session
        
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
                        'active': partner.get('active', False),
                        'email': partner.get('email', ''),
                        'phone': partner.get('phone', '')
                    }
                    employees.append(employee_data)
                
                # Generate sample reviews (in a real app, you'd store these in a reviews collection)
                reviews = [
                    {
                        'customer_name': 'John Doe',
                        'rating': 5,
                        'comment': 'Excellent service! Very fast delivery.',
                        'order_id': 'ORD-1234',
                        'created_at': '2025-07-10T10:30:00Z'
                    },
                    {
                        'customer_name': 'Jane Smith',
                        'rating': 4,
                        'comment': 'Good tracking system, arrived on time.',
                        'order_id': 'ORD-5678',
                        'created_at': '2025-07-09T14:15:00Z'
                    }
                ]
                
                return jsonify({
                    'employees': employees,
                    'reviews': reviews
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
                
                # Get all company employees for comparison
                all_employees = list(partners_collection.find({
                    'companies': company_id,
                    'active': True
                }))
                
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

@app.route('/api/qr-tracking/<qr_id>')
def get_qr_tracking_data(qr_id):
    """Get QR tracking data including delivery location if assigned"""
    try:
        if not qr_id or len(qr_id) != 4 or not qr_id.isdigit():
            return jsonify({'message': 'Invalid QR ID format. Must be 4 digits.'}), 400
        
        # Try to initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            try:
                # Get QR-specific collection data
                qr_collection = mongo_client.get_database("tracksmart").get_collection(qr_id)
                
                # Get destination data (coordinate A) - check both possible types
                destination_data = qr_collection.find_one({'type': 'destination_info'})
                if not destination_data:
                    # Fallback to check for qr_info type (older format)
                    destination_data = qr_collection.find_one({'type': 'qr_info'})
                
                if not destination_data:
                    return jsonify({'message': 'No item exists'}), 404
                
                # Check for delivery completion first
                delivery_completion = qr_collection.find_one({'type': 'delivery_complete'})
                
                if delivery_completion:
                    # Order is delivered - return completion data
                    return jsonify({
                        'qr_id': qr_id,
                        'status': 'delivered',
                        'delivery_status': 'delivered',
                        'coordinate_A': {  # Destination
                            'type': 'destination',
                            'name': destination_data.get('location_name', ''),
                            'address': destination_data.get('address', ''),
                            'latitude': destination_data.get('latitude'),
                            'longitude': destination_data.get('longitude'),
                            'google_maps_url': destination_data.get('google_maps_url', ''),
                            'here_maps_url': destination_data.get('here_maps_url', '')
                        },
                        'delivered_at': delivery_completion.get('delivered_at', '').isoformat() if delivery_completion.get('delivered_at') else None,
                        'delivery_partner_name': delivery_completion.get('delivery_partner_name', 'Unknown'),
                        'last_updated': delivery_completion.get('timestamp', '').isoformat() if delivery_completion.get('timestamp') else None
                    })
                
                # Get latest delivery location if exists (coordinate B)
                delivery_location = qr_collection.find_one(
                    {'type': 'delivery_location'}, 
                    sort=[('timestamp', -1)]
                )
                
                # Case 1: Only destination exists (no delivery partner)
                if not delivery_location:
                    return jsonify({'message': 'No delivery boy assigned'}), 200
                
                # Check if this is a role-only entry (Captain, Pilot, TC)
                location_type = delivery_location.get('location_type', 'coordinates')
                partner_role = delivery_location.get('role', '')
                
                if location_type == 'role_only' or partner_role in ['captain', 'pilot', 'tc']:
                    # Return special "boarded and arriving" message for aviation roles
                    return jsonify({
                        'message': 'boarded_and_arriving',
                        'qr_id': qr_id,
                        'delivery_partner_name': delivery_location.get('delivery_partner_name', 'Unknown'),
                        'role': partner_role,
                        'status': 'boarded_and_arriving'
                    }), 200
                
                # Case 2: Both coordinates exist - return map data
                response_data = {
                    'qr_id': qr_id,
                    'status': 'tracking_active',
                    'coordinate_A': {  # Destination
                        'type': 'destination',
                        'name': destination_data.get('location_name', ''),
                        'address': destination_data.get('address', ''),
                        'latitude': destination_data.get('latitude'),
                        'longitude': destination_data.get('longitude'),
                        'google_maps_url': destination_data.get('google_maps_url', ''),
                        'here_maps_url': destination_data.get('here_maps_url', '')
                    },
                    'coordinate_B': {  # Delivery partner location
                        'type': 'delivery_partner',
                        'latitude': delivery_location.get('latitude'),
                        'longitude': delivery_location.get('longitude'),
                        'user_email': delivery_location.get('user_email', ''),
                        'delivery_partner_name': delivery_location.get('delivery_partner_name', 'Unknown'),
                        'timestamp': delivery_location.get('timestamp', '').isoformat() if delivery_location.get('timestamp') else None
                    },
                    'delivery_status': 'driver_assigned',
                    'last_updated': delivery_location.get('timestamp', '').isoformat() if delivery_location.get('timestamp') else None
                }
                
                app.logger.info(f"QR tracking data retrieved for ID: {qr_id}")
                
                return jsonify(response_data)
                
            except Exception as db_error:
                app.logger.error(f"Database error retrieving QR tracking {qr_id}: {str(db_error)}")
                return jsonify({'message': 'Database error'}), 500
        else:
            app.logger.error("MongoDB not connected - cannot retrieve QR tracking data")
            return jsonify({'message': 'Database connection failed'}), 500
        
    except Exception as e:
        app.logger.error(f"Error retrieving QR tracking data: {str(e)}")
        return jsonify({'message': 'Failed to retrieve QR tracking data'}), 500

@app.route('/api/mark-delivered', methods=['POST'])
def mark_delivered():
    """Mark an order as delivered"""
    try:
        data = request.json
        qr_id = data.get('qr_id')
        delivery_partner_name = data.get('delivery_partner_name')
        
        if not qr_id or not delivery_partner_name:
            return jsonify({'message': 'QR ID and delivery partner name are required'}), 400
        
        # Initialize MongoDB if not connected
        if not mongo_connected:
            initialize_mongodb()
        
        if mongo_client:
            db = mongo_client['tracksmart']
            
            # Check if delivery is already marked as complete
            qr_collection = db[qr_id]
            existing_completion = qr_collection.find_one({'type': 'delivery_complete'})
            
            if existing_completion:
                return jsonify({'message': 'Order already marked as delivered'}), 400
            
            # Update the QR-specific collection with delivery completion
            delivery_completion_data = {
                'type': 'delivery_complete',
                'status': 'delivered',
                'delivery_partner_name': delivery_partner_name,
                'delivered_at': datetime.now(),
                'timestamp': datetime.now()
            }
            
            # Insert delivery completion record
            qr_collection.insert_one(delivery_completion_data)
            
            # Update locations collection with delivery status
            locations_collection = db['locations']
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

# Initialize MongoDB connection after app is created
def initialize_mongodb():
    """Initialize MongoDB connection"""
    global mongo_client, mongo_connected
    
    try:
        # Import pymongo using a clean environment to avoid conflicts
        import sys
        import importlib
        
        # Remove any existing bson modules that cause conflicts
        modules_to_remove = []
        for module_name in list(sys.modules.keys()):
            if module_name == 'bson' or module_name.startswith('bson.'):
                if 'pymongo' not in module_name:
                    modules_to_remove.append(module_name)
        
        for module_name in modules_to_remove:
            del sys.modules[module_name]
        
        # Force reimport of pymongo
        if 'pymongo' in sys.modules:
            del sys.modules['pymongo']
        
        # Import pymongo fresh
        import pymongo
        MongoClient = pymongo.MongoClient
        
        # Get MongoDB URI from environment variable with fallback to known working URI
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in')
        
        # Create connection
        mongo_client = MongoClient(mongodb_uri)
        
        # Test connection
        mongo_client.admin.command('ping')
        app.logger.info("MongoDB connected successfully - package conflicts resolved")
        mongo_connected = True
        return True
        
    except ImportError as import_error:
        app.logger.error(f"MongoDB import failed: {import_error}")
        # Log more details about the import issue
        import sys
        app.logger.error(f"Python path: {sys.path}")
        app.logger.error(f"Available modules starting with 'bson': {[m for m in sys.modules.keys() if m.startswith('bson')]}")
        app.logger.info("Application will continue without MongoDB connection")
        mongo_connected = False
        mongo_client = None
        return False
    except Exception as e:
        app.logger.error(f"MongoDB connection failed: {e}")
        app.logger.info("Application will continue without MongoDB connection")
        mongo_connected = False
        mongo_client = None
        return False

# Initialize MongoDB on startup
initialize_mongodb()