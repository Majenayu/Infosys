// QR Scanner - Fixed version
let html5QrcodeScanner = null;
let isScanning = false;
let isTracking = false;
let destination = null;
let currentQRId = null;

// DOM Elements
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const currentLocationSpan = document.getElementById('currentLocation');
const destinationInfoSpan = document.getElementById('destinationInfo');
const trackingStatusSpan = document.getElementById('trackingStatus');
const qrFileInput = document.getElementById('qrFileInput');

console.log('QR Scanner initializing...');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Page loaded, initializing QR scanner...');
  
  // Initialize map container
  const mapContainer = document.getElementById('mapContainer');
  if (mapContainer) {
    mapContainer.innerHTML = '<div style="background: #f8f9fa; height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 8px;"><div><h5 style="margin-bottom: 10px;">🗺️ Map Preview</h5><p>QR Scanner is ready to use<br>Map will display destination after scanning</p></div></div>';
  }
  
  // Set up event listeners
  if (startScanBtn) {
    startScanBtn.addEventListener('click', startScanning);
  }
  
  if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopScanning);
  }
  
  if (qrFileInput) {
    qrFileInput.addEventListener('change', handleFileUpload);
  }
  
  // Initialize automatic location tracking
  initializeLocationTracking();
  
  console.log('QR Scanner initialized successfully');
});

// Start QR code scanning
function startScanning() {
  if (isScanning) return;
  
  try {
    html5QrcodeScanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true
    });
    
    html5QrcodeScanner.render(onScanSuccess, onScanError);
    
    isScanning = true;
    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    
    showStatus('Camera started - Point camera at QR code', 'success');
    
  } catch (error) {
    console.error('Error starting scanner:', error);
    showStatus('Failed to start camera. Try file upload instead.', 'error');
  }
}

// Stop QR code scanning
function stopScanning() {
  if (!isScanning) return;
  
  try {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.clear();
    }
    
    isScanning = false;
    startScanBtn.disabled = false;
    stopScanBtn.disabled = true;
    
    showStatus('Camera stopped', 'success');
    
  } catch (error) {
    console.error('Error stopping scanner:', error);
  }
}

// Handle successful QR code scan
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code detected:', decodedText);
  
  try {
    // Try to parse as JSON first
    const qrData = JSON.parse(decodedText);
    
    if (qrData.latitude && qrData.longitude) {
      // Store QR ID for location tracking
      if (qrData.qr_id) {
        currentQRId = qrData.qr_id;
        localStorage.setItem('currentQRId', currentQRId);
        console.log('QR ID stored for location tracking:', currentQRId);
      }
      
      // Update destination info
      destination = {
        name: qrData.name || 'Unknown Location',
        address: qrData.address || 'Unknown Address',
        lat: qrData.latitude,
        lng: qrData.longitude
      };
      
      // Update UI
      updateDestinationInfo();
      
      // Start location tracking
      startLocationTracking();
      
      // Stop scanning after successful scan
      stopScanning();
      
      showStatus(`Destination set: ${destination.name}`, 'success');
      
    } else {
      throw new Error('Invalid QR code format');
    }
    
  } catch (error) {
    console.error('Failed to process QR code:', error);
    showStatus('Invalid QR code format. Please scan a valid location QR code.', 'error');
  }
}

// Handle QR code scan errors
function onScanError(error) {
  // Don't show errors for normal scanning attempts
  if (error.includes('QR code parse error') || error.includes('No QR code found')) {
    return;
  }
  console.log('QR scan error:', error);
}

// Update destination information display
function updateDestinationInfo() {
  if (!destination) return;
  
  if (destinationInfoSpan) {
    destinationInfoSpan.textContent = `${destination.name} - ${destination.address}`;
  }
  
  if (trackingStatusSpan) {
    trackingStatusSpan.textContent = 'Destination set, tracking location...';
  }
}

// Initialize location tracking
function initializeLocationTracking() {
  console.log('Starting automatic location tracking...');
  
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported', 'error');
    return;
  }
  
  // Start tracking immediately
  trackUserLocation();
  
  // Set up interval for continuous tracking
  setInterval(trackUserLocation, 5000); // Update every 5 seconds
}

// Track user location
function trackUserLocation() {
  if (!navigator.geolocation) return;
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      };
      
      // Update UI
      if (currentLocationSpan) {
        currentLocationSpan.textContent = `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`;
      }
      
      // Send to server
      sendLocationToServer(userLocation);
      
    },
    (error) => {
      console.error('Location error:', error);
      if (currentLocationSpan) {
        currentLocationSpan.textContent = 'Location access denied';
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

// Send location to server
async function sendLocationToServer(location) {
  try {
    // Get delivery partner email from localStorage
    const deliveryPartner = localStorage.getItem('deliveryPartner');
    let email = null;
    
    if (deliveryPartner) {
      const partner = JSON.parse(deliveryPartner);
      email = partner.email;
    }
    
    const data = {
      ...location,
      email: email,
      qr_id: currentQRId
    };
    
    const response = await fetch('/store-live-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      console.log('Live location updated successfully');
    } else {
      console.error('Failed to update live location');
    }
    
  } catch (error) {
    console.error('Error sending location:', error);
  }
}

// Start location tracking after QR scan
function startLocationTracking() {
  if (!destination) return;
  
  isTracking = true;
  
  if (trackingStatusSpan) {
    trackingStatusSpan.textContent = 'Location tracking active';
  }
  
  showStatus('Location tracking started', 'success');
}

// Handle file upload
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showStatus('Please select a valid image file', 'error');
    return;
  }
  
  showStatus('Processing QR code image...', 'success');
  
  try {
    // Try Html5Qrcode file scanning first
    const html5QrCode = new Html5Qrcode("temp-reader");
    const qrCodeData = await html5QrCode.scanFile(file, true);
    
    if (qrCodeData) {
      onScanSuccess(qrCodeData);
      return;
    }
    
  } catch (error) {
    console.log('File scanning failed:', error);
    showStatus('Could not read QR code from image. Please try a clearer image.', 'error');
  }
}

// Process manual QR data
function processManualQRData() {
  const manualQRData = document.getElementById('manualQRData');
  if (!manualQRData) return;
  
  const inputText = manualQRData.value.trim();
  if (!inputText) {
    showStatus('Please enter QR code data', 'error');
    return;
  }
  
  onScanSuccess(inputText);
  manualQRData.value = '';
}

// Load sample QR data
function loadSampleQRData() {
  const manualQRData = document.getElementById('manualQRData');
  if (!manualQRData) return;
  
  const sampleData = {
    "name": "Bangalore City Center",
    "address": "Bengaluru, Karnataka, India",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "googleMapsUrl": "https://www.google.com/maps?q=12.9716,77.5946",
    "hereMapsUrl": "https://wego.here.com/directions/mix/12.9716,77.5946",
    "timestamp": "2025-07-11T10:21:00.000Z",
    "qr_id": "7916"
  };
  
  manualQRData.value = JSON.stringify(sampleData, null, 2);
  showStatus('Sample QR data loaded! Click "Process Manual Data" to use it.', 'success');
}

// Show status messages
function showStatus(message, type) {
  const alertElement = document.getElementById('statusAlert');
  const messageElement = document.getElementById('statusMessage');
  
  if (!alertElement || !messageElement) return;
  
  messageElement.textContent = message;
  alertElement.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
  alertElement.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    alertElement.style.display = 'none';
  }, 5000);
}

// Test with sample location
function testSampleLocation() {
  const sampleQRData = JSON.stringify({
    name: "Bangalore City Center",
    address: "Bengaluru, Karnataka, India",
    latitude: 12.9716,
    longitude: 77.5946,
    googleMapsUrl: "https://www.google.com/maps?q=12.9716,77.5946",
    hereMapsUrl: "https://wego.here.com/directions/mix/12.9716,77.5946",
    timestamp: new Date().toISOString(),
    qr_id: "7916"
  });
  
  onScanSuccess(sampleQRData);
}

// Make functions available globally
window.processManualQRData = processManualQRData;
window.loadSampleQRData = loadSampleQRData;
window.testSampleLocation = testSampleLocation;

console.log('QR Scanner script loaded successfully');