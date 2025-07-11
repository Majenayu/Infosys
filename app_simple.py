import os
import logging
from flask import Flask, render_template, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# MongoDB connection - simplified approach
mongo_client = None
companies_collection = None
locations_collection = None
live_locations_collection = None

try:
    from pymongo import MongoClient
    mongo_client = MongoClient("mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in")
    mongo_db = mongo_client.get_database("tracksmart")
    
    # Collections
    companies_collection = mongo_db.get_collection("companies")
    locations_collection = mongo_db.get_collection("locations")
    live_locations_collection = mongo_db.get_collection("live_locations")
    
    app.logger.info("MongoDB connected successfully")
except Exception as e:
    app.logger.error(f"MongoDB connection failed: {e}")
    app.logger.info("Application will continue without MongoDB connection")

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

@app.route('/register-company', methods=['POST'])
def register_company():
    """Register a new logistics company"""
    try:
        data = request.get_json()
        
        if not companies_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Create company document
        company_doc = {
            'name': data['name'],
            'contact_person': data['contact_person'],
            'email': data['email'],
            'phone': data['phone'],
            'api_url': data['api_url'],
            'api_key': data['api_key'],
            'address': data['address'],
            'created_at': datetime.utcnow()
        }
        
        result = companies_collection.insert_one(company_doc)
        app.logger.info(f"Company registered: {data['name']}")
        
        return jsonify({
            'message': 'Company registered successfully!',
            'id': str(result.inserted_id)
        })
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Failed to register company'}), 500

@app.route('/store-location', methods=['POST'])
def store_location():
    """Store QR location data"""
    try:
        data = request.get_json()
        
        if not locations_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Create location document
        location_doc = {
            'name': data['name'],
            'address': data['address'],
            'latitude': data['latitude'],
            'longitude': data['longitude'],
            'google_maps_url': data.get('google_maps_url'),
            'here_maps_url': data.get('here_maps_url'),
            'timestamp': datetime.utcnow(),
            'qr_generated': True
        }
        
        result = locations_collection.insert_one(location_doc)
        app.logger.info(f"Location stored: {data['name']}")
        
        return jsonify({
            'message': 'Location stored successfully!',
            'id': str(result.inserted_id)
        })
        
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/locations')
def get_locations():
    """Get all stored locations"""
    try:
        if not locations_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        locations = list(locations_collection.find().sort('timestamp', -1).limit(100))
        locations_data = []
        
        for location in locations:
            locations_data.append({
                'id': str(location['_id']),
                'name': location['name'],
                'address': location['address'],
                'latitude': location['latitude'],
                'longitude': location['longitude'],
                'google_maps_url': location.get('google_maps_url'),
                'here_maps_url': location.get('here_maps_url'),
                'timestamp': location['timestamp'].isoformat(),
                'qr_generated': location.get('qr_generated', False)
            })
        
        return jsonify(locations_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch locations'}), 500

@app.route('/location/<location_id>')
def get_location(location_id):
    """Get a specific location by ID"""
    try:
        if not locations_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Try to find by ObjectId first, then by string ID
        location = None
        try:
            from bson import ObjectId
            location = locations_collection.find_one({'_id': ObjectId(location_id)})
        except:
            # If ObjectId fails, try with string ID
            location = locations_collection.find_one({'_id': location_id})
        
        if not location:
            return jsonify({'message': 'Location not found'}), 404
        
        location_data = {
            'id': str(location['_id']),
            'name': location['name'],
            'address': location['address'],
            'latitude': location['latitude'],
            'longitude': location['longitude'],
            'google_maps_url': location.get('google_maps_url'),
            'here_maps_url': location.get('here_maps_url'),
            'timestamp': location['timestamp'].isoformat(),
            'qr_generated': location.get('qr_generated', False)
        }
        
        return jsonify(location_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching location: {str(e)}")
        return jsonify({'message': 'Failed to fetch location'}), 500

@app.route('/companies')
def get_companies():
    """Get all registered companies"""
    try:
        if not companies_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        companies = list(companies_collection.find().sort('created_at', -1).limit(100))
        companies_data = []
        
        for company in companies:
            companies_data.append({
                'id': str(company['_id']),
                'name': company['name'],
                'contact_person': company['contact_person'],
                'email': company['email'],
                'phone': company['phone'],
                'api_url': company['api_url'],
                'api_key': company['api_key'],
                'address': company['address'],
                'created_at': company['created_at'].isoformat()
            })
        
        return jsonify(companies_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching companies: {str(e)}")
        return jsonify({'message': 'Failed to fetch companies'}), 500

@app.route('/store-live-location', methods=['POST'])
def store_live_location():
    """Store live location data in MongoDB"""
    try:
        data = request.get_json()
        
        if not live_locations_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Create live location document
        live_location_doc = {
            'latitude': data['latitude'],
            'longitude': data['longitude'],
            'timestamp': datetime.utcnow()
        }
        
        result = live_locations_collection.insert_one(live_location_doc)
        app.logger.info(f"Live location stored: {data['latitude']}, {data['longitude']}")
        
        return jsonify({
            'message': 'Live location stored successfully!',
            'id': str(result.inserted_id)
        })
        
    except Exception as e:
        app.logger.error(f"Error storing live location: {str(e)}")
        return jsonify({'message': 'Failed to store live location'}), 500

@app.route('/live-locations')
def get_live_locations():
    """Get live location data from MongoDB"""
    try:
        if not live_locations_collection:
            return jsonify({'message': 'Database connection failed'}), 500
        
        # Get recent live locations (last 100)
        live_locations = list(live_locations_collection.find().sort('timestamp', -1).limit(100))
        live_locations_data = []
        
        for location in live_locations:
            live_locations_data.append({
                'id': str(location['_id']),
                'latitude': location['latitude'],
                'longitude': location['longitude'],
                'timestamp': location['timestamp'].isoformat()
            })
        
        return jsonify(live_locations_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching live locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch live locations'}), 500