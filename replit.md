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
Added: Automatic location tracking instead of manual "Track Location" button
Added: Location data stored in individual user collections, not common collection
Updated: Removed QR scanner button from main navigation per user request
Updated: QR generation now creates unique 4-digit ID and dedicated MongoDB collection for each QR code
Updated: Prioritized HERE Maps API key VivkTzkLRp8BPWqRgV12KUmuOHfy6mobXyHUJSEfOcA as primary key across all JavaScript files
Updated: Enhanced rate limiting handling in all map initialization functions with delays and graceful fallback
Updated: Removed Route Distance and Travel Time display elements from delivery partner interface per user request (July 12, 2025)
Added: Separated company registration from main index page with dedicated registration and login pages storing data in MongoDB "companies" collection (July 12, 2025)
Updated: Simplified company registration form by removing API Base URL, API Key fields, and Location Preview map per user request (July 12, 2025)
Added: Unique company ID system starting from 1 - each registered company receives a sequential ID starting from 1 and incrementing for each new company (July 12, 2025)
Added: Unique user ID system starting from 1000 - each registered user receives a sequential ID starting from 1000 and incrementing for each new user (July 12, 2025)
Added: QR code user assignment system - companies can now select and assign users to specific QR codes from available users (July 12, 2025)
Added: Access control system for QR codes - only assigned users can access their QR codes, others receive error messages (July 12, 2025)
Added: API endpoint /api/check-qr-access/<qr_id>/<user_id> for checking user access to specific QR codes (July 12, 2025)
Added: User selection dropdown in QR generation page with validation to ensure user is selected before QR creation (July 12, 2025)
Added: Email notification system for QR code assignment - sends unique 4-digit QR code ID to assigned user's email automatically (July 12, 2025)
Added: Email service using pgayushrai@gmail.com as company sender with detailed QR code information and usage instructions (July 12, 2025)
Added: Comprehensive email templates with QR code details, usage instructions, and company contact information (July 12, 2025)
Added: Role-based delivery partner system with Captain, Pilot, TC, and Boy roles for specialized tracking behavior
Added: Complete company dashboard system with QR generation, order tracking, and employee management (July 12, 2025)
Added: Company-specific QR code generation that includes company ID for order differentiation and filtering (July 12, 2025)
Added: API endpoints for company dashboard data retrieval: /api/company/<id>/orders and /api/company/<id>/employees (July 12, 2025)
Fixed: QR code generation now properly includes company ID in both locations collection and QR-specific collections for accurate order tracking (July 12, 2025)
Enhanced: Company ID integration ensures QR codes are linked to the company that created them, enabling proper order differentiation and filtering (July 12, 2025)
MIGRATION COMPLETED: Successfully migrated from Replit Agent to Replit environment (July 12, 2025)
Enhanced: Company dashboard now shows order tracking immediately upon login without requiring "Go" button - direct access to progress (July 12, 2025)
Enhanced: Company authentication system uses company email/details instead of user credentials for direct company access (July 12, 2025)
Added: Interactive employee analytics with clickable names showing performance charts and company comparison metrics (July 12, 2025)
Added: Chart.js integration for radar charts and line graphs showing employee performance vs company averages (July 12, 2025)
Fixed: Resolved timedelta import error that was causing employee analytics API failures (July 12, 2025)
Security: Enhanced order access control ensuring only company employees can view company-specific orders (July 12, 2025)

## System Architecture

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Database**: MongoDB only (using PyMongo driver)
- **Connection**: mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in
- **Configuration**: Environment-based configuration with fallback defaults
- **Deployment**: Configured with ProxyFix middleware for production deployment behind reverse proxies

### Migration Status (July 12, 2025)
- **MongoDB Connection**: ✓ RESOLVED - Fixed package conflicts and installed pymongo==4.8.0 which works correctly
- **Package Management**: ✓ COMPLETED - Removed conflicting bson package, using only pymongo==4.8.0
- **QR Tracking API**: ✓ RESOLVED - Fixed /api/qr-tracking/<qr_id> endpoint to properly return coordinate data for maps
- **Application Status**: ✓ WORKING - All core features functional including user dashboard tracking
- **New Features Added**: QR tracking API endpoint (/api/qr-tracking/<qr_id>) for delivery status monitoring
- **QR Location Storage**: ✓ ENHANCED - QR generation now stores complete location data (coordinates, address, maps URLs) in QR-specific MongoDB collections
- **User Dashboard**: ✓ ENHANCED - Added location status panel showing coordinates, distance, travel time, speed, and delivery status
- **Delivery Location Tracking**: ✓ ENHANCED - Delivery partner locations stored in both user collection and QR-specific collection with upsert operations to prevent duplicates
- **HERE Maps Fixes**: ✓ RESOLVED - Fixed JavaScript errors in scan page with proper map layer initialization, custom marker icons, and error handling
- **QR Tracking System**: ✓ COMPLETED - Fixed coordinate storage separation:
  - Coordinate A (destination) stored as 'destination_info' type when QR is activated
  - Coordinate B (delivery partner live location) stored as 'delivery_location' type with partner name every 3 seconds
  - Special QR tracking mode stores only in QR-specific collections, not personal collections
  - Added Done button and stop conditions for tracking control

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
1. **Companies Collection** (ENHANCED - July 12, 2025)
   - Stores logistics company information with authentication
   - Fields: company_id, name, contact_person, email, phone, password, address, created_at, status
   - Purpose: Central registry for logistics companies with login/registration system
   - Authentication: Email/password based with separate registration and login pages
   - Simplified form: Removed API fields and location preview map
   - Unique ID system: Each company gets a sequential ID starting from 1, automatically incremented for each new registration

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
   - Each delivery partner gets their own empty collection named: delivery_{email_sanitized}
   - Purpose: Available for storing individual delivery partner's specific data and delivery history
   - Status: Empty collections automatically created upon registration (ready for future use)

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

4. **Automatic Location Tracking** (FULLY IMPLEMENTED & WORKING)
   - Removed manual "Track Location" button from QR scanner page
   - Automatic location tracking starts when scan page loads
   - Location data stored in individual user collections (not common collection)
   - Uses delivery partner email for collection targeting
   - Updates existing location data instead of creating multiple entries
   - Camera access improvements for better QR scanning experience
   - Status: Fully functional with MongoDB individual collection storage

5. **QR Code Generation with Unique IDs** (FULLY IMPLEMENTED & WORKING)
   - Each QR code gets a unique 4-digit ID (1000-9999)
   - Dedicated MongoDB collection created for each QR code using the 4-digit ID as collection name
   - QR ID displayed to user and included in download filename
   - Location data stored in both main locations collection and individual QR collection
   - Prevents duplicate ID generation with collision detection
   - QR ID now embedded in QR code JSON data for proper scanning
   - Status: Fully functional with MongoDB collection creation and unique ID management

6. **Live Location Tracking in QR Collections** (FULLY IMPLEMENTED & WORKING)
   - Driver location data now stored in QR-specific collections when QR code is scanned
   - QR ID extracted from scanned QR code and stored in localStorage
   - Location updates sent to both user's delivery collection and QR-specific collection
   - Enables tracking delivery progress for specific QR codes
   - Status: Fully functional with dual collection storage system

7. **Fixed QR Code Scanning Errors** (NEWLY IMPLEMENTED & WORKING)
   - Resolved "trackLocationBtn is not defined" JavaScript error
   - Fixed QR code detection failures with improved error handling
   - Added multiple QR code input methods: camera, file upload, manual input
   - Created scan_fixed.js with streamlined, error-free QR scanning functionality
   - Improved canvas processing with willReadFrequently attribute
   - Enhanced user experience with better status messages and fallback options
   - Status: All JavaScript errors resolved, QR scanning fully functional

8. **Successful Migration to Replit Environment** (COMPLETED - July 11, 2025)
   - Fixed MongoDB connection issues by removing conflicting bson package
   - Resolved pymongo import errors and established stable database connection with pymongo 4.8.0
   - Fixed location tracking to update existing records instead of creating duplicates
   - Applied security best practices including proper client/server separation
   - All major features verified working: company registration, QR generation, delivery partner system, location tracking
   - Successfully resolved package conflicts between standalone bson and pymongo's built-in bson module
   - MongoDB connection now fully functional with proper error handling and graceful fallback
   - Enhanced map display with proper sizing and road-based routing
   - Improved HERE Maps API integration with fallback systems
   - Status: Migration complete, project ready for production use

12. **MongoDB Connection Resolution** (COMPLETED - July 11, 2025)
    - Successfully resolved package conflicts between standalone bson==0.5.10 and pymongo's built-in bson module
    - Removed conflicting standalone bson package that was causing import errors
    - MongoDB connection now fully functional with pymongo 4.13.2 and proper bson module
    - Established stable database connection with proper error handling and graceful fallback
    - All major features verified working: company registration, QR generation, delivery partner system, location tracking
    - Successfully resolved package conflicts and MongoDB connection now fully operational
    - Added favicon support to eliminate 404 errors and improve user experience
    - Fixed HERE Maps marker visibility with improved color coding (red for destination, blue for current location)
    - Status: Migration complete, project ready for production use with fully functional database

10. **Enhanced Navigation with Blue Route Path and Travel Time** (COMPLETED - July 11, 2025)
    - Added blue route path visualization with 6px line width
    - Implemented travel time calculation based on route distance and speed
    - Added dynamic speed tracking using location change detection
    - Default speed of 10 km/h when no movement detected
    - Added UI elements for distance, travel time, and current speed display
    - Enhanced location status panel with real-time navigation metrics
    - Both HERE Maps routing and fallback direct path support travel time calculation
    - Status: Navigation system fully functional with blue paths and accurate travel time estimates

11. **Blue Route Generation and Distance/Time Features** (COMPLETED - July 11, 2025)
    - Confirmed blue route generation working with 6px width blue lines (#007bff)
    - Distance calculation using Haversine formula for accurate measurements
    - Travel time calculation with 10 km/h default speed for stationary users
    - Real-time speed tracking with dynamic updates during movement
    - UI displays distance, travel time, and current speed in location status panel
    - HERE Maps routing service integration with fallback to direct path
    - All features fully implemented and verified working in scan.html template
    - Status: Blue route navigation with distance/time calculation fully operational

12. **Role-based Delivery Partner System** (COMPLETED - July 11, 2025)
    - Added role selection during delivery partner registration with Captain, Pilot, TC, and Boy options
    - Implemented special handling for aviation roles (Captain/Pilot/TC) that store only role name as coordinate B
    - Aviation roles skip live location tracking and show "BOARDED AND ARRIVING" message in user dashboard
    - Regular delivery partners (Boy role) maintain full live location tracking functionality
    - Updated QR tracking API to return appropriate responses based on delivery partner role
    - Enhanced user dashboard to display three states: interactive map, no delivery assignment, and boarded/arriving message
    - All role-based logic integrated into existing MongoDB collections with backward compatibility
    - Frontend JavaScript prevents location tracking for aviation roles and sends role-only registration
    - Backend processes role_only flag to store aviation role information without coordinates
    - Status: Role-based tracking system fully operational with specialized aviation role handling

9. **Enhanced Map Navigation System** (UPDATED - July 12, 2025)
   - Added Google Maps-style navigation with live user location tracking
   - Implemented HERE Maps API integration with multiple backup API keys and progressive rate limiting delays
   - Enhanced HERE Maps with Google Maps-like styling: terrain/satellite layers, custom red/blue markers, thick blue routes
   - Created comprehensive fallback map system for when HERE Maps API fails with visual route information
   - Added Google Maps-style destination markers (red pins) and delivery truck markers (blue pins) using SVG icons
   - Implemented thick blue route lines (8px width) with rounded caps and joins for Google Maps appearance
   - Enhanced error handling with progressive API key testing and rate limit bypass mechanisms
   - Added "Open in Google Maps" button for external navigation when fallback is active
   - Fixed API key consistency and rate limiting issues with 1-5 second delays between API calls
   - Status: HERE Maps now displays with Google Maps styling and robust fallback system

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