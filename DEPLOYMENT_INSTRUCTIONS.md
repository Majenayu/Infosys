# Render Deployment Instructions for TrackSmart Company Service

## Current Status
✅ **READY FOR DEPLOYMENT** - All issues have been resolved locally

## Fixed Issues
1. **Template Routing**: Updated `templates/index.html` to use direct URLs instead of missing Flask routes
2. **MongoDB Connection**: Properly configured to use `MONGODB_URI` environment variable
3. **Dependencies**: Updated `render_requirements.txt` with stable package versions

## Deployment Steps

### 1. Create New Render Service
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository

### 2. Configure Service Settings
```
Name: tracksmart-company
Environment: Python 3
Build Command: pip install -r render_requirements.txt
Start Command: gunicorn --bind 0.0.0.0:$PORT --reuse-port company_app:app
```

### 3. Environment Variables
Set these in Render dashboard:
```
MONGODB_URI=mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in
SESSION_SECRET=(auto-generate)
PORT=10000
```

### 4. Important Files for Deployment
- `company_app.py` - Main Flask application
- `render_requirements.txt` - Python dependencies  
- `templates/` - HTML templates (fixed routing)
- `static/` - CSS, JS, and assets

## Key Features Working
✅ Company registration and login
✅ QR code generation with unique IDs
✅ MongoDB integration
✅ Employee analytics with charts
✅ Order tracking system
✅ HERE Maps API integration

## Routes Available
- `/` - Main company portal
- `/register` - Company registration
- `/login` - Company login  
- `/dashboard` - Company dashboard
- `/qr` - QR code generator
- `/api/here-keys` - Maps API keys
- `/api/company/register` - Registration API
- `/api/company/login` - Login API
- `/api/company/<id>/orders` - Company orders
- `/api/company/<id>/employees` - Employee management

## MongoDB Collections Used
- `companies` - Company registration data
- `locations` - QR code location data
- `delivery_partners` - Delivery partner data
- `users` - User data
- `{qr_id}` - Individual QR tracking collections

## Troubleshooting
If deployment fails:
1. Check Render logs for specific errors
2. Verify environment variables are set correctly
3. Ensure MongoDB connection string is valid
4. Check that all template files are included in deployment

## Success Verification
Once deployed, test these URLs:
- `https://tracksmart-company.onrender.com/` - Should show company portal
- `https://tracksmart-company.onrender.com/api/here-keys` - Should return JSON with API keys
- `https://tracksmart-company.onrender.com/register` - Should show registration form

## Contact
For deployment issues, the application includes customer care: **+91 9483246283**