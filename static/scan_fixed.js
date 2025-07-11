// QR Scanner - Fixed version
let html5QrcodeScanner = null;
let isScanning = false;
let isTracking = false;
let destination = null;
let currentQRId = null;
let map = null;
let platform = null;
let currentLocationMarker = null;
let destinationMarker = null;
let routeGroup = null;
let userLocation = null;

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
  
  // Initialize map
  initializeMap();
  
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
      
      // Initialize navigation features
      initializeNavigation();
      
      // Start location tracking
      startLocationTracking();
      
      // Stop scanning after successful scan
      stopScanning();
      
      showStatus(`Destination set: ${destination.name}. Starting navigation...`, 'success');
      
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
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: new Date().toISOString()
      };
      
      // Update navigation map if available
      if (map && destination) {
        const newLocation = {
          lat: locationData.latitude,
          lng: locationData.longitude
        };
        updateCurrentLocationMarker(newLocation);
      }
      
      // Update UI
      if (currentLocationSpan) {
        currentLocationSpan.textContent = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
      }
      
      // Send to server
      sendLocationToServer(locationData);
      
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
      console.log('Found delivery partner:', email);
    } else {
      console.log('No delivery partner found in localStorage - using guest email');
      // Use a guest email when no delivery partner is logged in
      email = 'guest@tracksmart.com';
    }
    
    const data = {
      ...location,
      user_email: email,
      email: email, // Keep both for compatibility
      qr_id: currentQRId
    };
    
    console.log('Sending location data:', data);
    
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
      console.error('Failed to update live location - Status:', response.status);
      const errorText = await response.text();
      console.error('Error details:', errorText);
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

// ====== HELPER FUNCTIONS ======

// Calculate distance between two points using Haversine formula
function calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Calculate travel time based on distance and speed
function calculateTravelTime(distanceInMeters, routeTimeInSeconds = null) {
  if (routeTimeInSeconds) {
    // Use actual route time if available
    return routeTimeInSeconds;
  }
  
  // Use current speed if available, otherwise default to 10 km/h
  const speedKmH = window.currentSpeed || 10;
  const distanceInKm = distanceInMeters / 1000;
  const timeInHours = distanceInKm / speedKmH;
  const timeInSeconds = timeInHours * 3600;
  
  return Math.round(timeInSeconds);
}

// Calculate current speed from location updates
function calculateCurrentSpeed(oldLocation, newLocation) {
  if (!oldLocation || !newLocation || !window.lastLocationUpdate) {
    return 0;
  }
  
  const distance = calculateDistance(oldLocation, newLocation); // in km
  const timeElapsed = (Date.now() - window.lastLocationUpdate) / 1000; // in seconds
  
  if (timeElapsed === 0) return 0;
  
  const speedKmH = (distance / timeElapsed) * 3600; // convert to km/h
  return Math.max(0, speedKmH);
}

// Update travel time display
function updateTravelTimeDisplay(timeInSeconds, distanceInMeters) {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const distanceKm = (distanceInMeters / 1000).toFixed(1);
  
  let timeDisplay = '';
  if (hours > 0) {
    timeDisplay = `${hours}h ${minutes}m`;
  } else {
    timeDisplay = `${minutes}m`;
  }
  
  // Update UI elements
  const travelTimeSpan = document.getElementById('travelTime');
  const distanceSpan = document.getElementById('distance');
  
  if (travelTimeSpan) {
    travelTimeSpan.textContent = timeDisplay;
  }
  
  if (distanceSpan) {
    distanceSpan.textContent = `${distanceKm} km`;
  }
  
  // Update status message
  showStatus(`Route: ${distanceKm} km, ETA: ${timeDisplay}`, 'success');
}

// Update speed tracking
function updateSpeedTracking(speedKmH) {
  window.currentSpeed = speedKmH;
  window.lastLocationUpdate = Date.now();
  
  const speedSpan = document.getElementById('currentSpeed');
  if (speedSpan) {
    speedSpan.textContent = `${speedKmH.toFixed(1)} km/h`;
  }
}

// Make functions available globally
window.processManualQRData = processManualQRData;
window.loadSampleQRData = loadSampleQRData;
window.testSampleLocation = testSampleLocation;

// ====== NAVIGATION FUNCTIONS ======

// Initialize HERE Maps with rate limiting handling
async function initializeMap() {
  try {
    const API_KEY = 'qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI';
    console.log('Initializing navigation map with prioritized API key');
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Initialize HERE Maps platform
    platform = new H.service.Platform({ apikey: API_KEY });
    
    // Initialize layers with error handling
    let defaultLayers;
    try {
      defaultLayers = platform.createDefaultLayers();
    } catch (layerError) {
      console.warn('Vector layers failed, trying fallback approach:', layerError);
      showStatus('Map loading with reduced functionality due to rate limits', 'warning');
      initializeFallbackMap();
      return;
    }
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
      throw new Error('Map container not found');
    }
    
    // Initialize map with fallback layer selection
    const mapLayer = defaultLayers.vector?.normal?.map || defaultLayers.raster?.normal?.map;
    if (!mapLayer) {
      throw new Error('No map layers available');
    }
    
    map = new H.Map(mapContainer, mapLayer, {
      zoom: 10,
      center: { lat: 12.9716, lng: 77.5946 } // Bangalore coordinates
    });
    
    // Enable map events and behaviors
    mapEvents = new H.mapevents.MapEvents(map);
    behavior = new H.mapevents.Behavior(mapEvents);
    ui = H.ui.UI.createDefault(map);
    
    console.log('Navigation map initialized successfully');
    showStatus('Map loaded successfully', 'success');
    
    // Initialize navigation after map is ready
    initializeNavigation();
    
  } catch (error) {
    console.error('Error initializing map:', error);
    showStatus('Map temporarily unavailable due to API rate limits - using fallback', 'warning');
    initializeFallbackMap();
  }
}

// Initialize navigation after QR scan
function initializeNavigation() {
  if (!destination) return;
  
  console.log('Initializing navigation to:', destination);
  
  // Check if we have a functioning map
  if (map) {
    // Clear existing markers and routes
    if (currentLocationMarker) {
      map.removeObject(currentLocationMarker);
    }
    if (destinationMarker) {
      map.removeObject(destinationMarker);
    }
    if (routeGroup) {
      map.removeObject(routeGroup);
    }
    
    // Add destination marker
    addDestinationMarker();
    
    // Get user's current location and set up navigation
    getCurrentLocationAndNavigate();
  } else if (window.fallbackMapMode) {
    // Use fallback map functionality
    initializeFallbackNavigation();
  }
}

// Add destination marker to map
function addDestinationMarker() {
  if (!destination || !map) return;
  
  // Create destination marker
  const destIcon = new H.map.Icon(
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#dc3545"/></svg>',
    { size: { w: 24, h: 24 } }
  );
  
  destinationMarker = new H.map.Marker(
    { lat: destination.lat, lng: destination.lng },
    { icon: destIcon }
  );
  
  map.addObject(destinationMarker);
  
  // Center map on destination
  map.setCenter({ lat: destination.lat, lng: destination.lng });
  map.setZoom(12);
  
  console.log('Destination marker added');
}

// Get current location and start navigation
function getCurrentLocationAndNavigate() {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported', 'error');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      console.log('Current location obtained:', userLocation);
      
      // Add current location marker
      addCurrentLocationMarker();
      
      // Calculate and display route
      calculateRoute();
      
      // Update location display
      updateLocationDisplay();
      
    },
    (error) => {
      console.error('Error getting location:', error);
      showStatus('Could not get your location. Please enable location services.', 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Add current location marker
function addCurrentLocationMarker() {
  if (!userLocation || !map) return;
  
  // Create current location marker
  const currentIcon = new H.map.Icon(
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#007bff" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>',
    { size: { w: 20, h: 20 } }
  );
  
  currentLocationMarker = new H.map.Marker(
    { lat: userLocation.lat, lng: userLocation.lng },
    { icon: currentIcon }
  );
  
  map.addObject(currentLocationMarker);
  
  console.log('Current location marker added');
}

// Calculate and display route
function calculateRoute() {
  if (!userLocation || !destination || !map) return;
  
  console.log('Calculating route from', userLocation, 'to', destination);
  
  // Get routing service
  const router = platform.getRoutingService();
  
  // Set up routing parameters
  const routingParameters = {
    'mode': 'fastest;car',
    'start': `${userLocation.lat},${userLocation.lng}`,
    'destination': `${destination.lat},${destination.lng}`,
    'representation': 'display'
  };
  
  // Calculate route
  router.calculateRoute(routingParameters, 
    (result) => {
      if (result.response.route) {
        const route = result.response.route[0];
        displayRoute(route);
        
        // Fit map to show both locations
        const group = new H.map.Group();
        group.addObject(currentLocationMarker);
        group.addObject(destinationMarker);
        map.getViewPort().setViewBounds(group.getBounds());
        
        showStatus('Route calculated successfully', 'success');
      }
    },
    (error) => {
      console.error('Error calculating route:', error);
      showStatus('Could not calculate route. Showing direct path.', 'error');
      displayDirectPath();
    }
  );
}

// Display route on map
function displayRoute(route) {
  if (!route || !map) return;
  
  // Create route polyline
  const routeShape = route.shape;
  const lineString = new H.geo.LineString();
  
  routeShape.forEach((point) => {
    const parts = point.split(',');
    lineString.pushPoint(parseFloat(parts[0]), parseFloat(parts[1]));
  });
  
  // Create route line in blue color
  const routeLine = new H.map.Polyline(lineString, {
    style: {
      strokeColor: '#007bff',
      lineWidth: 6,
      lineCap: 'round',
      lineJoin: 'round'
    }
  });
  
  // Add route to map
  routeGroup = new H.map.Group();
  routeGroup.addObject(routeLine);
  map.addObject(routeGroup);
  
  // Calculate and display travel time
  const routeDistance = route.summary.distance; // in meters
  const routeTime = route.summary.travelTime; // in seconds
  
  // Calculate travel time based on route info or use default speed
  const estimatedTime = calculateTravelTime(routeDistance, routeTime);
  
  // Update UI with travel time
  updateTravelTimeDisplay(estimatedTime, routeDistance);
  
  console.log('Route displayed on map with travel time:', estimatedTime);
}

// Display direct path if routing fails
function displayDirectPath() {
  if (!userLocation || !destination || !map) return;
  
  // Create direct line
  const lineString = new H.geo.LineString();
  lineString.pushPoint(userLocation.lat, userLocation.lng);
  lineString.pushPoint(destination.lat, destination.lng);
  
  const directLine = new H.map.Polyline(lineString, {
    style: {
      strokeColor: '#007bff',
      lineWidth: 4,
      lineCap: 'round',
      strokeDasharray: '10 5'
    }
  });
  
  routeGroup = new H.map.Group();
  routeGroup.addObject(directLine);
  map.addObject(routeGroup);
  
  // Calculate straight-line distance for travel time estimation
  const distance = calculateDistance(userLocation, destination);
  const estimatedTime = calculateTravelTime(distance * 1000); // Convert to meters
  
  // Update UI with estimated travel time
  updateTravelTimeDisplay(estimatedTime, distance * 1000);
  
  console.log('Direct path displayed with estimated time:', estimatedTime);
}

// Update location display
function updateLocationDisplay() {
  if (!userLocation) return;
  
  if (currentLocationSpan) {
    currentLocationSpan.textContent = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
  }
  
  if (trackingStatusSpan) {
    trackingStatusSpan.textContent = 'Navigation active - Route displayed';
  }
}

// Update current location marker during tracking
function updateCurrentLocationMarker(newLocation) {
  if (!newLocation || !map) return;
  
  // Calculate speed if we have previous location
  const currentSpeed = calculateCurrentSpeed(userLocation, newLocation);
  
  userLocation = newLocation;
  
  // Update marker position
  if (currentLocationMarker) {
    currentLocationMarker.setGeometry({ lat: newLocation.lat, lng: newLocation.lng });
  }
  
  // Update location display
  updateLocationDisplay();
  
  // Recalculate route if needed with updated speed
  if (destination) {
    calculateRoute();
  }
  
  // Update speed tracking
  if (currentSpeed > 0) {
    updateSpeedTracking(currentSpeed);
  }
}

// Fallback map functions
function initializeFallbackMap() {
  console.log('Initializing fallback map functionality');
  
  // Show fallback map data when QR is scanned
  window.fallbackMapMode = true;
  
  // Get current location for fallback display
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fallbackCurrentLocation = document.getElementById('fallbackCurrentLocation');
        if (fallbackCurrentLocation) {
          fallbackCurrentLocation.textContent = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
        }
        
        // Store user location for fallback navigation
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      },
      (error) => {
        console.log('Fallback location error:', error);
      }
    );
  }
}

function initializeFallbackNavigation() {
  console.log('Initializing fallback navigation');
  
  // Show fallback map data
  const fallbackMapData = document.getElementById('fallbackMapData');
  if (fallbackMapData) {
    fallbackMapData.style.display = 'block';
  }
  
  // Update destination in fallback view
  const fallbackDestination = document.getElementById('fallbackDestination');
  if (fallbackDestination && destination) {
    fallbackDestination.textContent = `${destination.name} (${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)})`;
  }
  
  // Get current location for navigation
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        const fallbackCurrentLocation = document.getElementById('fallbackCurrentLocation');
        if (fallbackCurrentLocation) {
          fallbackCurrentLocation.textContent = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
        }
      },
      (error) => {
        console.log('Error getting location for fallback navigation:', error);
      }
    );
  }
}

function openExternalMap() {
  if (userLocation && destination) {
    const mapUrl = `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${destination.lat},${destination.lng}`;
    window.open(mapUrl, '_blank');
  } else if (destination) {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;
    window.open(mapUrl, '_blank');
  } else {
    showStatus('Please scan a QR code first to set destination', 'error');
  }
}

// Make functions available globally
window.openExternalMap = openExternalMap;

console.log('QR Scanner script loaded successfully');