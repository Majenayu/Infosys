// QR Scanner and Navigation functionality
const API_KEYS = [
    'YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI'
];
let currentApiKeyIndex = 0;
let platform, defaultLayers, map, routingService, ui;
let userMarker, destinationMarker, routeLine;
let destination = null;
let trackingInterval = null;
let html5QrcodeScanner = null;
let isScanning = false;
let isTracking = false;

// DOM Elements
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const currentLocationSpan = document.getElementById('currentLocation');
const destinationInfoSpan = document.getElementById('destinationInfo');
const trackingStatusSpan = document.getElementById('trackingStatus');
const routeInfoDiv = document.getElementById('routeInfo');
const manualQRInput = document.getElementById('manualQRInput');
const processManualBtn = document.getElementById('processManualBtn');
const testSampleBtn = document.getElementById('testSampleBtn');
const qrFileInput = document.getElementById('qrFileInput');

// Initialize HERE Maps
const initializeMap = () => {
  // Skip HERE Maps for now and use fallback
  console.log('Skipping HERE Maps initialization, using fallback...');
  const mapContainer = document.getElementById('mapContainer');
  if (mapContainer) {
    mapContainer.innerHTML = '<div style="background: #f8f9fa; height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 8px;"><div><h5 style="margin-bottom: 10px;">🗺️ Map Preview</h5><p>QR Scanner is ready to use<br>Map will display destination after scanning</p></div></div>';
    showStatus('Scanner ready - Map will show after QR scan.', 'success');
  }
};

const initializeMapWithDelay = () => {
  try {
    console.log('Attempting to initialize map...');
    
    // Check if HERE Maps is available
    if (typeof H === 'undefined') {
      throw new Error('HERE Maps API not loaded');
    }
    
    // Initialize HERE platform with minimal setup
    platform = new H.service.Platform({
      'apikey': API_KEYS[currentApiKeyIndex]
    });
    
    // Get default map layers
    defaultLayers = platform.createDefaultLayers();
    
    // Initialize map container
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) {
      // Create HERE map with minimal configuration
      map = new H.Map(mapContainer, defaultLayers.vector.normal.map, {
        zoom: 10,
        center: { lat: 12.3052, lng: 76.65532 } // Default center
      });
      
      console.log('HERE Maps initialized successfully (basic mode)');
      showStatus('Scanner ready with map visualization.', 'success');
    }
    
  } catch (error) {
    console.error('Failed to initialize map:', error);
    console.log('Backup map initialization...');
    
    // Fallback to simple display
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) {
      mapContainer.innerHTML = '<div style="background: #f8f9fa; height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; padding: 20px; text-align: center;">Map temporarily unavailable - QR scanning still functional</div>';
    }
    showStatus('Map unavailable but QR scanning works fine.', 'warning');
  }
};

// Check camera support
const checkCameraSupport = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API not supported - using manual input only');
      return false;
    }
    
    // Test basic camera access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' }
        } 
      });
      
      // Stop the stream immediately after testing
      stream.getTracks().forEach(track => track.stop());
      console.log('Camera access confirmed');
      return true;
      
    } catch (accessError) {
      console.warn('Camera access denied or unavailable:', accessError.message);
      return false;
    }
  } catch (error) {
    console.warn('Camera support check failed:', error.message);
    return false;
  }
};

// Initialize QR Code Scanner
const initializeScanner = async () => {
  try {
    // Wait for Html5Qrcode to be available
    if (typeof Html5Qrcode === 'undefined') {
      console.warn('Html5Qrcode not loaded yet, waiting...');
      setTimeout(initializeScanner, 1000);
      return;
    }
    
    // Check camera support first
    const cameraSupported = await checkCameraSupport();
    if (!cameraSupported) {
      startScanBtn.disabled = true;
      startScanBtn.textContent = '⚠️ Camera Not Available';
      showStatus('Camera not available. Use manual input below.', 'error');
      return;
    }
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    console.log('QR Scanner initialized successfully');
    showStatus('QR Scanner ready. Click "Start Camera" to begin.', 'success');
  } catch (error) {
    console.error('Failed to initialize QR scanner:', error);
    showStatus('QR Scanner initialization failed. Use manual input.', 'error');
    startScanBtn.disabled = true;
    startScanBtn.textContent = '⚠️ Scanner Error';
  }
};

// Start QR Code Scanning
const startScanning = async () => {
  if (!html5QrcodeScanner || isScanning) return;

  try {
    startScanBtn.disabled = true;
    startScanBtn.textContent = '🔄 Starting Camera...';

    // First check for camera permissions
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not supported by this browser');
    }

    // Request camera permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream
    } catch (permError) {
      console.error('Camera permission error:', permError);
      if (permError.name === 'NotAllowedError') {
        throw new Error('Camera access denied. Please allow camera permission and reload.');
      } else if (permError.name === 'NotSecureError' || permError.message.includes('secure')) {
        throw new Error('Camera requires HTTPS. Please access via secure connection.');
      } else {
        throw new Error(`Camera not available: ${permError.message}`);
      }
    }

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 2
    };

    // Try environment camera first, fallback to user camera
    let cameraConfig = { facingMode: "environment" };
    
    try {
      await html5QrcodeScanner.start(cameraConfig, config, onScanSuccess, onScanError);
    } catch (envError) {
      console.warn('Environment camera failed, trying user camera:', envError);
      cameraConfig = { facingMode: "user" };
      await html5QrcodeScanner.start(cameraConfig, config, onScanSuccess, onScanError);
    }

    isScanning = true;
    startScanBtn.textContent = '📹 Camera Active';
    stopScanBtn.disabled = false;
    showStatus('Camera started. Point at a QR code to scan.', 'success');
  } catch (error) {
    console.error('Failed to start scanning:', error);
    let errorMessage = 'Failed to start camera. ';
    
    if (error.message.includes('permission')) {
      errorMessage += 'Please allow camera access and try again.';
    } else if (error.message.includes('not supported')) {
      errorMessage += 'Camera not supported by this browser.';
    } else {
      errorMessage += 'Please check camera permissions and try again.';
    }
    
    showStatus(errorMessage, 'error');
    startScanBtn.disabled = false;
    startScanBtn.textContent = '📹 Start Camera';
  }
};

// Stop QR Code Scanning
const stopScanning = async () => {
  if (!html5QrcodeScanner || !isScanning) return;

  try {
    await html5QrcodeScanner.stop();
    isScanning = false;
    startScanBtn.disabled = false;
    startScanBtn.textContent = '📹 Start Camera';
    stopScanBtn.disabled = true;
    showStatus('Camera stopped', 'success');
  } catch (error) {
    console.error('Failed to stop scanning:', error);
    showStatus('Failed to stop camera', 'error');
  }
};

// Handle successful QR scan
const onScanSuccess = (decodedText, decodedResult) => {
  try {
    console.log('QR Code detected:', decodedText);
    
    // Try to parse as JSON (location data)
    const locationData = JSON.parse(decodedText);
    
    if (locationData.latitude && locationData.longitude) {
      destination = {
        lat: locationData.latitude,
        lng: locationData.longitude,
        name: locationData.name || 'Scanned Location',
        address: locationData.address || 'Unknown Address'
      };

      // Store QR ID for location tracking
      if (locationData.qr_id) {
        localStorage.setItem('currentQRId', locationData.qr_id);
        console.log('QR ID stored for location tracking:', locationData.qr_id);
      }

      // Update destination info
      destinationInfoSpan.textContent = `${destination.name} - ${destination.address}`;
      
      // Show destination on map
      showDestinationOnMap(destination);
      
      // Start location tracking automatically
      startLocationTracking();
      
      // Stop scanning after successful scan
      stopScanning();
      
      const qrIdMessage = locationData.qr_id ? ` (QR ID: ${locationData.qr_id})` : '';
      showStatus(`QR code scanned successfully! Destination: ${destination.name}${qrIdMessage}`, 'success');
    } else {
      throw new Error('Invalid location data in QR code');
    }
  } catch (error) {
    console.error('Failed to process QR code:', error);
    showStatus('Invalid QR code format. Please scan a valid location QR code.', 'error');
  }
};

// Handle QR scan errors
const onScanError = (error) => {
  // Don't show errors for scanning attempts, only log them
  console.debug('QR scan error:', error);
};

// Show destination on map with road visualization
const showDestinationOnMap = (dest) => {
  if (!map) return;

  // Remove existing destination marker
  if (destinationMarker) {
    map.removeObject(destinationMarker);
  }

  // Create destination marker
  const iconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#28a745" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
    </svg>
  `;
  
  const icon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkup));
  destinationMarker = new H.map.Marker({ lat: dest.lat, lng: dest.lng }, { icon });
  map.addObject(destinationMarker);

  // Center map on destination
  map.setCenter({ lat: dest.lat, lng: dest.lng });
  map.setZoom(12);

  // Show info bubble
  if (ui) {
    const bubble = new H.ui.InfoBubble({ lat: dest.lat, lng: dest.lng }, { 
      content: `<strong>${dest.name}</strong><br>${dest.address}` 
    });
    ui.addBubble(bubble);
    setTimeout(() => ui.removeBubble(bubble), 5000);
  }
};

// Start location tracking
const startLocationTracking = () => {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by this browser', 'error');
    return;
  }

  if (isTracking) {
    showStatus('Location tracking already active', 'success');
    return;
  }

  trackLocationBtn.disabled = true;
  trackLocationBtn.textContent = '🔄 Starting Tracking...';

  // Get initial position
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      updateUserLocation(userLocation);
      
      // Start continuous tracking
      startContinuousTracking();
      
      isTracking = true;
      trackLocationBtn.textContent = '🔄 Tracking Active';
      trackingStatusSpan.textContent = 'Active';
      showStatus('Location tracking started', 'success');
    },
    (error) => {
      console.error('Geolocation error:', error);
      let message = 'Unable to get location';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Location access denied. Please allow location access.';
      }
      showStatus(message, 'error');
      trackLocationBtn.disabled = false;
      trackLocationBtn.textContent = '🎯 Enable Location Tracking';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
};

// Start continuous location tracking
const startContinuousTracking = () => {
  // Watch position changes
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        updateUserLocation(userLocation);
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }

  // Send location to server every 3 seconds
  trackingInterval = setInterval(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString()
          };
          sendLiveLocation(locationData);
        },
        (error) => {
          console.error('Failed to get location for tracking:', error);
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: 15000
        }
      );
    }
  }, 3000);
};

// Update user location on map
const updateUserLocation = (userLocation) => {
  if (!map) return;

  // Remove existing user marker
  if (userMarker) {
    map.removeObject(userMarker);
  }

  // Create user marker
  const userIconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#007bff" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#007bff"/>
      <circle cx="12" cy="12" r="6" fill="#ffffff"/>
      <circle cx="12" cy="12" r="2" fill="#007bff"/>
    </svg>
  `;
  
  const userIcon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(userIconMarkup));
  userMarker = new H.map.Marker(userLocation, { icon: userIcon });
  map.addObject(userMarker);

  // Update location display
  currentLocationSpan.textContent = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;

  // Calculate and display route if destination exists
  if (destination) {
    calculateRoute(userLocation, destination);
  }
};

// Calculate route between user and destination (from live location to destination)
const calculateRoute = async (from, to) => {
  try {
    // Remove existing route line if map is available
    if (map && routeLine) {
      map.removeObject(routeLine);
      routeLine = null;
    }

    // Use HERE Maps Routing API v8 directly with fallback
    let response;
    let data;
    
    // Try different API keys if rate limited
    for (let i = 0; i < API_KEYS.length; i++) {
      const apiKey = API_KEYS[(currentApiKeyIndex + i) % API_KEYS.length];
      const routingUrl = `https://router.hereapi.com/v8/routes?apikey=${apiKey}&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&return=summary,polyline&transportMode=car&routingMode=fast`;
      
      try {
        response = await fetch(routingUrl);
        
        if (response.status !== 429) {
          currentApiKeyIndex = (currentApiKeyIndex + i) % API_KEYS.length;
          data = await response.json();
          break;
        }
        
        if (response.status === 429) {
          console.warn(`API key ${i + 1} rate limited, trying next key...`);
          continue;
        }
      } catch (fetchError) {
        console.warn(`API key ${i + 1} failed:`, fetchError.message);
        continue;
      }
      
      if (i === API_KEYS.length - 1) {
        throw new Error('All API keys exhausted or rate limited');
      }
    }

    if (!data.routes || data.routes.length === 0) {
      console.warn('No route found in response');
      routeInfoDiv.innerHTML = '<p class="text-warning">No route available between locations</p>';
      return;
    }

    const route = data.routes[0];
    
    // Decode polyline and create route line for road visualization
    if (map && route.sections && route.sections[0] && route.sections[0].polyline) {
      const polyline = route.sections[0].polyline;
      const lineString = new H.geo.LineString();
      
      // Decode HERE polyline format
      const decoded = decodeHerePolyline(polyline);
      decoded.forEach(point => {
        lineString.pushLatLngAlt(point.lat, point.lng, 0);
      });

      // Create route polyline - road route like Google Maps
      routeLine = new H.map.Polyline(lineString, {
        style: { 
          strokeColor: '#4285f4', 
          lineWidth: 8,
          lineDash: [0, 2],
          lineCap: 'round'
        }
      });

      map.addObject(routeLine);
      
      // Auto-zoom to fit route
      const routeBounds = routeLine.getBoundingBox();
      map.getViewModel().setLookAtData({
        bounds: routeBounds,
        margin: 50
      });
    }
    
    console.log('Route sections available:', route.sections?.length || 0);

    // Update route information - show road route details
    if (route.summary) {
      const distance = (route.summary.length / 1000).toFixed(2);
      const time = Math.round(route.summary.duration / 60);
      
      console.log(`Road route calculated: ${distance} km, ${time} minutes`);
      
      routeInfoDiv.innerHTML = `
        <div class="row">
          <div class="col-6">
            <strong>Distance:</strong> ${distance} km
          </div>
          <div class="col-6">
            <strong>Time:</strong> ${time} min
          </div>
        </div>
        <div class="mt-2">
          <small class="text-muted">Route updated based on current location</small>
        </div>
      `;
    }

    // Fit map to show both markers and route
    if (userMarker && destinationMarker) {
      const group = new H.map.Group();
      group.addObject(userMarker);
      group.addObject(destinationMarker);
      if (routeLine) group.addObject(routeLine);
      map.getViewModel().setLookAtData({ bounds: group.getBoundingBox() });
    }

    console.log('Route calculated successfully');

  } catch (error) {
    console.error('Route calculation error:', error);
    routeInfoDiv.innerHTML = '<p class="text-danger">Route calculation failed. Please try again.</p>';
  }
};

// Decode HERE polyline format
const decodeHerePolyline = (polyline) => {
  const coordinates = [];
  let lat = 0, lng = 0;
  let index = 0;
  
  while (index < polyline.length) {
    let b, shift = 0, result = 0;
    
    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }
  
  return coordinates;
};

// Send live location to server
const sendLiveLocation = async (locationData) => {
  try {
    // Get user email from localStorage (set during login)
    const userEmail = localStorage.getItem('deliveryUserEmail');
    
    if (!userEmail) {
      console.warn('No user email found, cannot store location');
      return;
    }
    
    // Get current QR ID if available (from scanned QR code)
    const currentQRId = localStorage.getItem('currentQRId');
    
    const data = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: new Date().toISOString(),
      user_email: userEmail,
      qr_id: currentQRId // Include QR ID if available
    };
    
    const response = await fetch('/store-live-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to send location');
    }

    console.log('Live location updated successfully');
  } catch (error) {
    console.error('Failed to send live location:', error);
  }
};

// Process manual QR input
const processManualInput = () => {
  if (!manualQRInput) return;
  
  const inputText = manualQRInput.value.trim();
  if (!inputText) {
    showStatus('Please enter QR code data', 'error');
    return;
  }
  
  // Process the input as if it was scanned
  onScanSuccess(inputText);
  manualQRInput.value = ''; // Clear input
};

// Process manual QR data from the new text area
const processManualQRData = () => {
  const manualQRData = document.getElementById('manualQRData');
  if (!manualQRData) return;
  
  const inputText = manualQRData.value.trim();
  if (!inputText) {
    showStatus('Please enter QR code data', 'error');
    return;
  }
  
  // Process the input as if it was scanned
  onScanSuccess(inputText);
  manualQRData.value = ''; // Clear input
};

// Load sample QR data for testing
const loadSampleQRData = () => {
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
};

// Test with sample location
const testSampleLocation = () => {
  const sampleQRData = JSON.stringify({
    name: "Bangalore City Center",
    address: "Bangalore, Karnataka, India",
    latitude: 12.9716,
    longitude: 77.5946,
    googleMapsUrl: "https://www.google.com/maps?q=12.9716,77.5946",
    hereMapsUrl: "https://wego.here.com/directions/mix/12.9716,77.5946",
    timestamp: new Date().toISOString(),
    qr_id: "1234" // Sample QR ID for testing
  });
  
  onScanSuccess(sampleQRData);
  showStatus('Sample location loaded successfully!', 'success');
};

// Handle file upload for QR code images
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    showStatus('Please select a valid image file', 'error');
    return;
  }
  
  showStatus('Processing QR code image...', 'success');
  
  try {
    // First try with Html5Qrcode library (better for file uploads)
    try {
      const html5QrCode = new Html5Qrcode("temp-reader");
      const qrCodeData = await html5QrCode.scanFile(file, true);
      
      if (qrCodeData) {
        showStatus('QR code detected from image!', 'success');
        onScanSuccess(qrCodeData);
        return;
      }
    } catch (html5Error) {
      console.log('Html5Qrcode failed, trying jsQR...', html5Error);
    }
    
    // Fallback to jsQR with canvas processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = async () => {
      try {
        // Set canvas dimensions to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0);
        
        // Get image data for jsQR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Try jsQR
        if (typeof jsQR !== 'undefined') {
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code) {
            showStatus('QR code detected from image!', 'success');
            onScanSuccess(code.data);
            return;
          }
        }
        
        // Try with different image processing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Enhance contrast
        ctx.filter = 'contrast(150%) brightness(110%)';
        ctx.drawImage(img, 0, 0);
        
        const enhancedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        if (typeof jsQR !== 'undefined') {
          const enhancedCode = jsQR(enhancedImageData.data, enhancedImageData.width, enhancedImageData.height, {
            inversionAttempts: "attemptBoth",
          });
          
          if (enhancedCode) {
            showStatus('QR code detected from enhanced image!', 'success');
            onScanSuccess(enhancedCode.data);
            return;
          }
        }
        
        // No QR code found
        showStatus('No QR code found in the image. Please try a clearer image or use the camera scanner.', 'error');
        
      } catch (error) {
        console.error('Canvas processing error:', error);
        showStatus('Error processing image. Please try a different image.', 'error');
      }
    };
    
    img.onerror = () => {
      showStatus('Failed to load image. Please try a different file.', 'error');
    };
    
    // Load the image
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
  } catch (error) {
    console.error('File processing error:', error);
    showStatus('Error processing file. Please try again.', 'error');
  }
};

// Show status messages
const showStatus = (message, type) => {
  const alertElement = document.getElementById('statusAlert');
  const messageElement = document.getElementById('statusMessage');
  
  if (!alertElement || !messageElement) return;
  
  // Set message and type
  messageElement.textContent = message;
  alertElement.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show`;
  
  // Show alert
  alertElement.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (alertElement.classList.contains('show')) {
      alertElement.classList.remove('show');
      setTimeout(() => {
        alertElement.style.display = 'none';
      }, 150);
    }
  }, 5000);
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
  console.log('QR Scanner initializing...');
  
  // Initialize components
  initializeMap();
  await initializeScanner();
  
  // Setup event listeners
  if (startScanBtn) {
    startScanBtn.addEventListener('click', startScanning);
  }
  
  if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopScanning);
  }
  
  // Auto-start location tracking when page loads
  initializeLocationTracking();

  // Initialize location tracking function
  function initializeLocationTracking() {
    if (navigator.geolocation) {
      console.log('Starting automatic location tracking...');
      
      // Get initial location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          // Update UI
          if (currentLocationSpan) {
            currentLocationSpan.textContent = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
          }
          
          // Send to server
          sendLiveLocation(locationData);
          
          if (trackingStatusSpan) {
            trackingStatusSpan.textContent = 'Location tracking active';
          }
        },
        (error) => {
          console.error('Error getting initial location:', error);
          if (trackingStatusSpan) {
            trackingStatusSpan.textContent = 'Location access denied';
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      
      // Watch position changes
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          // Update UI
          if (currentLocationSpan) {
            currentLocationSpan.textContent = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
          }
          
          // Send to server
          sendLiveLocation(locationData);
        },
        (error) => {
          console.error('Error watching location:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      );
      
      // Store watchId for cleanup
      trackingInterval = watchId;
    } else {
      console.warn('Geolocation not supported');
      if (trackingStatusSpan) {
        trackingStatusSpan.textContent = 'Geolocation not supported';
      }
    }
  }
  
  if (processManualBtn) {
    processManualBtn.addEventListener('click', processManualInput);
  }
  
  if (testSampleBtn) {
    testSampleBtn.addEventListener('click', testSampleLocation);
  }
  
  if (qrFileInput) {
    qrFileInput.addEventListener('change', handleFileUpload);
  }
  
  console.log('QR Scanner initialization complete');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }
  if (html5QrcodeScanner && isScanning) {
    html5QrcodeScanner.stop();
  }
});

// Window load backup - simplified
window.addEventListener('load', () => {
  console.log('Page loaded, ensuring UI is ready...');
  
  // Ensure status message is shown
  setTimeout(() => {
    const statusAlert = document.getElementById('statusAlert');
    if (statusAlert) {
      statusAlert.style.display = 'block';
      statusAlert.classList.add('show');
    }
  }, 1000);
});