import os
import logging
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app with root directory as template and static folder
app = Flask(__name__, template_folder='.', static_folder='.')
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///tracksmart.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the extension
db.init_app(app)

# Company model
class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    contact_person = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    api_url = db.Column(db.String(500), nullable=False)
    api_key = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Location model for QR data
class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    google_maps_url = db.Column(db.String(500))
    here_maps_url = db.Column(db.String(500))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    qr_generated = db.Column(db.Boolean, default=True)

# Live location model for tracking
class LiveLocation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()
    app.logger.info("Database tables created successfully")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/qr')
def qr_generator():
    return render_template('qr.html')

@app.route('/scan')
def qr_scanner():
    return render_template('scan.html')

@app.route('/register-company', methods=['POST'])
def register_company():
    try:
        data = request.get_json()
        
        new_company = Company(
            name=data['name'],
            contact_person=data['contactPerson'],
            email=data['email'],
            phone=data['phone'],
            api_url=data['apiUrl'],
            api_key=data['apiKey'],
            address=data['address']
        )
        
        db.session.add(new_company)
        db.session.commit()
        
        app.logger.info(f"Company registered: {data['name']}")
        return jsonify({'message': 'Company registered successfully!'})
        
    except Exception as e:
        app.logger.error(f"Error registering company: {str(e)}")
        db.session.rollback()
        return jsonify({'message': 'Server error'}), 500

@app.route('/store-location', methods=['POST'])
def store_location():
    try:
        data = request.get_json()
        
        location_data = Location(
            name=data['name'],
            address=data['address'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            google_maps_url=data.get('googleMapsUrl'),
            here_maps_url=data.get('hereMapsUrl')
        )
        
        db.session.add(location_data)
        db.session.commit()
        
        app.logger.info(f"Location stored: {data['name']}")
        return jsonify({'message': 'Location stored successfully!', 'id': location_data.id})
        
    except Exception as e:
        app.logger.error(f"Error storing location: {str(e)}")
        db.session.rollback()
        return jsonify({'message': 'Failed to store location'}), 500

@app.route('/locations')
def get_locations():
    try:
        locations = Location.query.order_by(Location.timestamp.desc()).all()
        locations_data = []
        
        for location in locations:
            locations_data.append({
                'id': location.id,
                'name': location.name,
                'address': location.address,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'googleMapsUrl': location.google_maps_url,
                'hereMapsUrl': location.here_maps_url,
                'timestamp': location.timestamp.isoformat(),
                'qrGenerated': location.qr_generated
            })
        
        return jsonify(locations_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch locations'}), 500

@app.route('/location/<int:location_id>')
def get_location(location_id):
    try:
        location = Location.query.get_or_404(location_id)
        
        location_data = {
            'id': location.id,
            'name': location.name,
            'address': location.address,
            'latitude': location.latitude,
            'longitude': location.longitude,
            'googleMapsUrl': location.google_maps_url,
            'hereMapsUrl': location.here_maps_url,
            'timestamp': location.timestamp.isoformat(),
            'qrGenerated': location.qr_generated
        }
        
        return jsonify(location_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching location: {str(e)}")
        return jsonify({'message': 'Failed to fetch location'}), 500

@app.route('/companies')
def get_companies():
    try:
        companies = Company.query.order_by(Company.created_at.desc()).all()
        companies_data = []
        
        for company in companies:
            companies_data.append({
                'id': company.id,
                'name': company.name,
                'contactPerson': company.contact_person,
                'email': company.email,
                'phone': company.phone,
                'apiUrl': company.api_url,
                'address': company.address,
                'createdAt': company.created_at.isoformat()
            })
        
        return jsonify(companies_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching companies: {str(e)}")
        return jsonify({'message': 'Failed to fetch companies'}), 500

@app.route('/live-location', methods=['POST'])
def store_live_location():
    try:
        data = request.get_json()
        
        live_location = LiveLocation(
            latitude=data['latitude'],
            longitude=data['longitude']
        )
        
        db.session.add(live_location)
        db.session.commit()
        
        app.logger.info(f"Live location stored: {data['latitude']}, {data['longitude']}")
        return jsonify({'message': 'Live location stored successfully!'})
        
    except Exception as e:
        app.logger.error(f"Error storing live location: {str(e)}")
        db.session.rollback()
        return jsonify({'message': 'Failed to store live location'}), 500

@app.route('/live-locations')
def get_live_locations():
    try:
        live_locations = LiveLocation.query.order_by(LiveLocation.timestamp.desc()).limit(100).all()
        locations_data = []
        
        for location in live_locations:
            locations_data.append({
                'id': location.id,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'timestamp': location.timestamp.isoformat()
            })
        
        return jsonify(locations_data)
        
    except Exception as e:
        app.logger.error(f"Error fetching live locations: {str(e)}")
        return jsonify({'message': 'Failed to fetch live locations'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
