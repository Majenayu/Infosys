const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // Serve static files

// MongoDB Connection
const mongoUri = "mongodb+srv://in:in@in.hfxejxb.mongodb.net/?retryWrites=true&w=majority&appName=in";
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Company Schema
const CompanySchema = new mongoose.Schema({
  name: String,
  contactPerson: String,
  email: String,
  phone: String,
  apiUrl: String,
  apiKey: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});

// Location Schema for QR data
const LocationSchema = new mongoose.Schema({
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  googleMapsUrl: String,
  hereMapsUrl: String,
  timestamp: { type: Date, default: Date.now },
  qrGenerated: { type: Boolean, default: true }
});

const Company = mongoose.model('Company', CompanySchema);
const Location = mongoose.model('Location', LocationSchema);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'qr.html'));
});

// Register company API
app.post('/register-company', async (req, res) => {
  try {
    const newCompany = new Company(req.body);
    await newCompany.save();
    res.json({ message: 'Company registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Store location data from QR generator
app.post('/store-location', async (req, res) => {
  try {
    const locationData = new Location(req.body);
    await locationData.save();
    res.json({ message: 'Location stored successfully!', id: locationData._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to store location' });
  }
});

// Get all locations
app.get('/locations', async (req, res) => {
  try {
    const locations = await Location.find().sort({ timestamp: -1 });
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

// Get specific location
app.get('/location/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.json(location);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch location' });
  }
});

// Get companies
app.get('/companies', async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch companies' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));