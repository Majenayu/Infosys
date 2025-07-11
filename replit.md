# TrackSmart - Logistics Company Registration & QR Location Generator

## Overview

TrackSmart is a web application designed for registering logistics companies and generating QR codes for specific locations. The system consists of a company registration module and a QR location generator with interactive mapping capabilities. The application is built with Flask (Python) for the backend and uses HERE Maps API for location services.

## User Preferences

Preferred communication style: Simple, everyday language.
Database preference: MongoDB only (no local SQLite storage)
Priority: Functional QR code file upload from device
Priority: Avoid HERE Maps API rate limiting issues
Added: Delivery partner login/register system with individual MongoDB collections per user
Added: Navigation integration with "Delivery Boy" button replacing QR scanner navigation

## System Architecture

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Database**: MongoDB only (using PyMongo driver)
- **Connection**: mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in
- **Configuration**: Environment-based configuration with fallback defaults
- **Deployment**: Configured with ProxyFix middleware for production deployment behind reverse proxies

### Frontend Architecture
- **Template Engine**: Jinja2 (Flask's default)
- **Styling**: Bootstrap with Replit dark theme
- **Maps Integration**: HERE Maps JavaScript API v3.1
- **QR Generation**: QRCode.js library
- **Interactive Features**: Real-time location search with autocomplete

### Technology Stack
- **Backend**: Python, Flask, SQLAlchemy
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap
- **Maps**: HERE Maps API
- **QR Codes**: QRCode.js library
- **Database**: SQLite (default), PostgreSQL compatible

## Key Components

### Database Collections (MongoDB)
1. **Companies Collection**
   - Stores logistics company information
   - Fields: name, contact_person, email, phone, api_url, api_key, address, created_at
   - Purpose: Central registry for logistics companies

2. **Locations Collection**
   - Stores QR-generated location data
   - Fields: name, address, latitude, longitude, google_maps_url, here_maps_url, timestamp, qr_generated
   - Purpose: Track locations where QR codes have been generated

3. **Live_Locations Collection**
   - Stores real-time location tracking data
   - Fields: latitude, longitude, timestamp
   - Purpose: Track user's live location for route calculation

4. **Delivery_Partners Collection** (IMPLEMENTED & WORKING)
   - Stores delivery partner registration data
   - Fields: name, email, phone, address, vehicle_type, license, password, created_at, active, deliveries
   - Purpose: Manage delivery partner accounts and authentication
   - Status: Fully functional with MongoDB storage

5. **Individual Delivery Collections** (IMPLEMENTED & WORKING)
   - Each delivery partner gets their own collection named: delivery_{email_sanitized}
   - Purpose: Store individual delivery partner's specific data and delivery history
   - Status: Automatically created upon registration with profile data

### Core Features
1. **Company Registration System**
   - Web form for registering logistics companies
   - Map integration for address verification
   - API endpoint for form submission

2. **QR Location Generator**
   - Interactive map interface
   - Location search with autocomplete
   - QR code generation for selected coordinates
   - Download functionality for generated QR codes

3. **Delivery Partner System** (FULLY IMPLEMENTED & WORKING)
   - Login/Register interface for delivery partners (/delivery route)
   - Complete form validation and error handling
   - Real-time MongoDB data storage and retrieval
   - Individual MongoDB collections created per delivery partner
   - Authentication against stored credentials
   - Session management with localStorage
   - Successful login redirects to scan page
   - Integrated navigation across all pages with "Delivery Boy" button
   - Status: Fully functional with verified database operations

### API Integration
- **HERE Maps API**: Provides mapping, geocoding, and search functionality
- **API Key Management**: Centralized API key configuration
- **Fallback Strategy**: Multiple API keys available for redundancy

## Data Flow

### Company Registration Flow
1. User fills registration form on main page
2. Form data validated on client-side
3. AJAX submission to Flask backend
4. Data stored in Company model via SQLAlchemy
5. Success/error response returned to user

### QR Generation Flow
1. User searches or clicks on map location
2. HERE Maps API geocodes the location
3. Location data stored in Location model
4. QR code generated containing location information
5. QR code displayed and available for download

## External Dependencies

### Third-Party Services
- **HERE Maps API**: Location services, mapping, geocoding
- **QRCode.js**: Client-side QR code generation
- **Bootstrap CDN**: UI framework and styling

### JavaScript Libraries
- HERE Maps JS API (v3.1): Core mapping functionality
- QRCode.js: QR code generation
- Bootstrap: Responsive UI components

### Python Packages
- Flask: Web framework
- PyMongo: MongoDB driver
- Werkzeug: WSGI utilities and middleware

## Deployment Strategy

### Environment Configuration
- **Database**: Configurable via DATABASE_URL environment variable
- **Security**: Session secret configurable via SESSION_SECRET
- **API Keys**: Environment-based configuration for HERE Maps API

### Production Considerations
- ProxyFix middleware configured for reverse proxy deployment
- Database connection pooling with health checks
- Logging configured for debugging and monitoring
- Static file serving through Flask (suitable for development/small-scale)

### Scalability Notes
- SQLite suitable for development and small deployments
- PostgreSQL support available through DATABASE_URL configuration
- Static assets served by Flask (consider CDN for production)
- API rate limiting may be needed for HERE Maps integration

### Security Features
- Environment-based secret key management
- Input validation on forms
- CORS considerations for API endpoints
- SQL injection protection through SQLAlchemy ORM