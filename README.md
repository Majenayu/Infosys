# 📦 TrackSmart - Smart Delivery Tracking System

<div align="center">

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/Python-42.4%25-blue?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-40.3%25-yellow?style=flat-square)
![HTML](https://img.shields.io/badge/HTML-16.4%25-red?style=flat-square)
![Flask](https://img.shields.io/badge/Flask-2.0+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)

**A comprehensive QR-code based delivery tracking and management platform with real-time location monitoring**

[User Portal](https://tracksmart-user.onrender.com) • [Delivery Portal](https://tracksmart-delivery.onrender.com) • [Company Portal](https://tracksmart-company.onrender.com) • [Report Bug](https://github.com/Majenayu/Infosys/issues)

</div>

---

## 📋 Project Information

**Project Name:** TrackSmart - Smart Delivery Tracking System  
**Developer:** P G AYUSH RAI (majen) - [@Majenayu](https://github.com/Majenayu)  
**Build Date:** 2023  
**Project Type:** Full-Stack Delivery Management Platform  
**Version:** 1.0.0  

**Live Deployments:**
- User Service: [tracksmart-user.onrender.com](https://tracksmart-user.onrender.com)
- Delivery Service: [tracksmart-delivery.onrender.com](https://tracksmart-delivery.onrender.com)
- Company Service: [tracksmart-company.onrender.com](https://tracksmart-company.onrender.com)

---

## 🎯 About The Project

TrackSmart is an innovative delivery tracking and management system that leverages QR codes and real-time GPS location tracking to provide transparency and efficiency in logistics operations. The platform consists of three independent services catering to different user roles: customers, delivery partners, and companies.

### Key Features

✨ **QR Code Generation & Tracking** - Generate unique 4-digit QR codes for each delivery  
📍 **Real-Time Location Tracking** - Live GPS tracking of delivery partners  
🗺️ **Interactive Maps** - HERE Maps API integration with route visualization  
👥 **Multi-Role Support** - Different interfaces for users, delivery partners, and companies  
📧 **Email Notifications** - Automated notifications when QR codes are assigned  
🚚 **Delivery Partner Management** - Assign partners to specific companies  
📊 **Analytics Dashboard** - Company insights and employee performance tracking  
🔒 **Access Control** - QR codes assigned to specific users  
⚡ **Microservices Architecture** - Three independent services for scalability  
🌐 **Cross-Platform** - Responsive design for desktop and mobile  

---

## 🛠️ Technologies Used

### Backend
- **Python 3** - Core programming language
- **Flask** - Web application framework
- **MongoDB Atlas** - Cloud database solution
- **PyMongo** - MongoDB driver for Python
- **Gunicorn** - WSGI HTTP Server for deployment

### Frontend
- **HTML5** - Structure and markup
- **CSS3** - Styling and responsive design
- **JavaScript (ES6+)** - Client-side interactivity
- **HERE Maps API** - Interactive mapping and route visualization

### Additional Services
- **Email Service** - Automated notification system
- **QR Code Generation** - Unique delivery tracking codes
- **Render** - Cloud hosting platform
- **Replit** - Development environment

---

## 📂 Project Structure

```
Infosys/
│
├── app.py                          # Main application (combined services)
├── user_app.py                     # User service (tracking portal)
├── delivery_app.py                 # Delivery partner service
├── company_app.py                  # Company management service
├── email_service.py                # Email notification service
├── models.py                       # Database models
│
├── templates/                      # HTML templates
│   ├── index.html                  # Main landing page
│   ├── user.html                   # User login/register
│   ├── user_dashboard.html         # User tracking dashboard
│   ├── delivery.html               # Delivery partner portal
│   ├── company.html                # Company registration
│   ├── company_login.html          # Company login
│   ├── company_dashboard.html      # Company management dashboard
│   ├── qr.html                     # QR code generator
│   ├── scan.html                   # QR code scanner
│   └── ...                         # Additional templates
│
├── static/                         # Static assets
│   ├── css/                        # Stylesheets
│   ├── js/                         # JavaScript files
│   └── images/                     # Images and icons
│
├── attached_assets/                # Project documentation and assets
├── instance/                       # Instance-specific configuration
│
├── render.yaml                     # Render deployment configuration
├── DEPLOYMENT.md                   # Deployment documentation
├── RENDER_DEPLOYMENT_SUMMARY.md    # Deployment summary
├── render_requirements.txt         # Python dependencies for Render
├── pyproject.toml                  # Python project configuration
├── uv.lock                         # Dependency lock file
│
└── README.md                       # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+**
- **MongoDB Atlas Account** (or local MongoDB instance)
- **HERE Maps API Keys** (multiple keys for reliability)
- **pip** (Python package manager)
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Majenayu/Infosys.git
   cd Infosys
   ```

2. **Install dependencies**
   ```bash
   pip install -r render_requirements.txt
   ```

3. **Configure environment variables**
   Create a `.env` file or set environment variables:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   SESSION_SECRET=your-secret-key-here
   PORT=10000
   ```

4. **Run the application**
   
   **Option A: Run all services in one (development)**
   ```bash
   python app.py
   ```
   
   **Option B: Run individual services**
   ```bash
   # User service
   python user_app.py
   
   # Delivery service
   python delivery_app.py
   
   # Company service
   python company_app.py
   ```

5. **Access the application**
   - Open your browser and navigate to:
     ```
     http://localhost:10000
     ```

---

## 📱 Platform Overview

### 1. User Portal

**Features:**
- User registration and login
- QR code scanning and tracking
- Real-time delivery location viewing
- Order status updates
- Delivery history
- Customer care contact

**Access:** [https://tracksmart-user.onrender.com](https://tracksmart-user.onrender.com)

### 2. Delivery Partner Portal

**Features:**
- Delivery partner registration
- Role selection (Boy, Captain, Pilot, TC)
- QR code scanning
- Live location sharing
- Company assignment
- Delivery status updates
- Route navigation

**Access:** [https://tracksmart-delivery.onrender.com](https://tracksmart-delivery.onrender.com)

### 3. Company Portal

**Features:**
- Company registration and login
- QR code generation with location
- User assignment to QR codes
- Delivery partner management
- Order tracking dashboard
- Employee performance analytics
- Email notifications
- Company-specific delivery partner filtering

**Access:** [https://tracksmart-company.onrender.com](https://tracksmart-company.onrender.com)

---

## 💡 How It Works

### QR Code Tracking Workflow

1. **QR Generation**
   - Company generates a unique 4-digit QR code for a delivery
   - QR code is linked to destination coordinates (Coordinate A)
   - QR code is assigned to a specific user
   - User receives email notification

2. **Delivery Assignment**
   - Delivery partner scans the QR code
   - System verifies QR access permissions
   - Live location tracking begins (Coordinate B)

3. **Real-Time Tracking**
   - User can track delivery in real-time
   - Map displays both destination and delivery partner location
   - Route visualization with HERE Maps
   - Status updates (Pending → In Progress → Boarded → Delivered)

4. **Role-Based Tracking**
   - **Boy**: Full GPS tracking with coordinates
   - **Captain/Pilot/TC**: Role indicator only (no coordinates for privacy)

5. **Delivery Completion**
   - Delivery partner marks order as delivered
   - User receives completion notification
   - Order moved to delivery history

---

## 🗺️ Mapping Integration

### HERE Maps API Features

- **Multiple API Keys**: 5 keys for reliability and load distribution
- **Route Visualization**: Draw routes between coordinates
- **Location Markers**: Custom markers for destinations and delivery partners
- **Interactive Controls**: Zoom, pan, and street view
- **Geocoding**: Convert addresses to coordinates
- **Reverse Geocoding**: Get addresses from coordinates

---

## 🔧 API Endpoints

### Authentication
```
POST /user/register                # Register new user
POST /user/login                   # User login
POST /delivery/register            # Register delivery partner
POST /delivery/login               # Delivery partner login
POST /company/register             # Register company
POST /company/login                # Company login
```

### QR Code Management
```
POST /store-location               # Generate and store QR code
POST /activate-qr/<qr_id>          # Activate QR code after download
GET  /api/qr-code/<qr_id>          # Get QR code details
GET  /api/qr-tracking/<qr_id>      # Get tracking data for QR code
GET  /api/check-qr-access/<qr_id>/<user_id>  # Check access permissions
```

### Location Tracking
```
POST /store-live-location          # Store delivery partner location
POST /stop-qr-tracking             # Stop tracking session
GET  /live-locations               # Get all live locations
```

### Company Management
```
GET  /api/companies                # Get all companies
GET  /api/users                    # Get all users
GET  /api/delivery-partners        # Get all delivery partners
GET  /api/company/<id>/delivery-partners    # Get company-specific partners
GET  /api/company/<id>/orders      # Get company orders
GET  /api/company/<id>/employees   # Get employees and reviews
GET  /api/company/<id>/employee/<name>/analytics  # Employee analytics
```

### Utilities
```
GET  /api/here-keys                # Get HERE Maps API keys
GET  /list-collections             # List MongoDB collections
POST /api/mark-delivered           # Mark order as delivered
```

---

## 💾 Database Schema

### Collections

#### companies
```javascript
{
  company_id: Number (unique, auto-increment),
  name: String,
  contact_person: String,
  email: String (unique),
  phone: String,
  password: String,
  address: String,
  created_at: Date,
  status: String (active/inactive)
}
```

#### users
```javascript
{
  user_id: Number (unique, auto-increment from 1000),
  name: String,
  email: String (unique),
  phone: String,
  address: String,
  password: String,
  created_at: Date,
  active: Boolean,
  tracking_history: Array
}
```

#### delivery_partners
```javascript
{
  name: String,
  email: String (unique),
  phone: String,
  address: String,
  role: String (boy/captain/pilot/tc),
  vehicle_type: String,
  license: String,
  password: String,
  companies: Array<Number>,  // Company IDs
  created_at: Date,
  active: Boolean
}
```

#### locations
```javascript
{
  qr_id: String (4 digits),
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  google_maps_url: String,
  here_maps_url: String,
  company_id: Number,
  assigned_user_id: Number,
  timestamp: Date,
  status: String,
  qr_generated: Boolean
}
```

#### {qr_id} (Dynamic Collections)
```javascript
// Destination Info (Coordinate A)
{
  type: 'destination_info',
  qr_id: String,
  location_name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  coordinate_type: 'A'
}

// Delivery Location (Coordinate B)
{
  type: 'delivery_location',
  latitude: Number,
  longitude: Number,
  user_email: String,
  delivery_partner_name: String,
  role: String,
  timestamp: Date,
  coordinate_type: 'B'
}

// Delivery Complete
{
  type: 'delivery_complete',
  status: 'delivered',
  delivered_at: Date
}
```

---

## 🌐 Deployment

### Render Platform (Production)

The application is deployed as three separate microservices:

1. **User Service** (`user_app.py`)
2. **Delivery Service** (`delivery_app.py`)
3. **Company Service** (`company_app.py`)

**Deployment Method:**
- Using `render.yaml` blueprint for automatic deployment
- Each service runs independently with Gunicorn
- Shared MongoDB Atlas database
- Automatic HTTPS certificates
- Environment-based configuration

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

## 🔒 Security Features

- **Access Control**: QR codes assigned to specific users
- **Authentication**: Session-based user authentication
- **Password Storage**: Plain text (for demo - use hashing in production)
- **HTTPS**: Automatic SSL certificates on Render
- **Input Validation**: Server-side validation for all inputs
- **CORS Protection**: Controlled cross-origin requests
- **MongoDB Injection Prevention**: PyMongo sanitization

---

## 📊 Features Breakdown

### Completed Features ✅
- Multi-service architecture
- QR code generation and tracking
- Real-time GPS location tracking
- Interactive map visualization
- Email notification system
- Company-specific delivery partner assignment
- Employee performance analytics
- Role-based access control
- Mobile-responsive design
- Production deployment on Render

### Future Enhancements 🚧
- [ ] Password hashing and JWT authentication
- [ ] Real-time notifications with WebSockets
- [ ] Mobile app (iOS/Android)
- [ ] Advanced analytics and reporting
- [ ] Multiple language support
- [ ] Payment gateway integration
- [ ] Delivery proof of delivery (photos)
- [ ] Customer rating system
- [ ] Route optimization algorithms
- [ ] Push notifications
- [ ] Blockchain for delivery verification
- [ ] AI-powered ETA predictions

---

## 🐛 Known Issues

- Passwords stored in plain text (development only)
- Cold start delays on Render free tier
- MongoDB connection issues require retry logic
- HERE Maps API rate limits on free tier
- Manual QR code download process

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'Add some NewFeature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

---

## 📄 License

This project is part of an internship/academic initiative.  
For licensing inquiries, please contact the developer.

---

## 👤 Developer

**P G AYUSH RAI (majen)**

- GitHub: [@Majenayu](https://github.com/Majenayu)
- Project: TrackSmart Delivery Tracking System

---

## 🙏 Acknowledgments

- **HERE Technologies** - For mapping and location services
- **MongoDB** - For cloud database services
- **Render** - For hosting platform
- **Flask Community** - For excellent documentation
- **Open Source Contributors** - For the amazing libraries used

---

## 📞 Support

For issues, questions, or suggestions:
- Open an [Issue](https://github.com/Majenayu/Infosys/issues)
- Contact: P G AYUSH RAI (majen) [@Majenayu](https://github.com/Majenayu)

---

## 📈 Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

<div align="center">

**Made with ❤️ by P G AYUSH RAI (majen)**

⭐ Star this repository if you find it helpful!

**TrackSmart** | **Smart Delivery Tracking**

</div>
