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

# MongoDB connection - simplified approach without problematic imports
mongo_client = None
companies_collection = None
locations_collection = None
live_locations_collection = None

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
        
        # For now, just return success without database operations
        # This will be functional once MongoDB connection is fixed
        app.logger.info(f"Company registration request: {data.get('name', 'Unknown')}")
        
        return jsonify({
            'message': 'Company registration received successfully!',
            'note': 'Database storage will be activated once MongoDB connection is established'
        })
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        return jsonify({'message': 'Failed to register company'}), 500

@app.route('/store-location', methods=['POST'])
def store_location():
    """Store QR location data"""
    try:
        data = request.get_json()
        
        # For now, just return success without database operations
        app.logger.info(f"Location storage request: {data.get('name', 'Unknown')}")
        
        return jsonify({
            'message': 'Location data received successfully!',
            'note': 'Database storage will be activated once MongoDB connection is established'
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
    """Store live location data"""
    try:
        data = request.get_json()
        
        # For now, just return success without database operations
        app.logger.info(f"Live location storage request: {data.get('latitude', 'Unknown')}, {data.get('longitude', 'Unknown')}")
        
        return jsonify({
            'message': 'Live location data received successfully!',
            'note': 'Database storage will be activated once MongoDB connection is established'
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

# Initialize MongoDB connection after app is created
def initialize_mongodb():
    """Initialize MongoDB connection"""
    global mongo_client, companies_collection, locations_collection, live_locations_collection
    
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

# Try to initialize MongoDB on startup
initialize_mongodb()