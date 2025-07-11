// QR Scanner - Clean version
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
      
    } else {
      showStatus('Invalid QR code format - missing location data', 'error');
    }
    
  } catch (error) {
    console.error('Error parsing QR code:', error);
    showStatus('Error reading QR code data', 'error');
  }
}

// Handle QR scan errors
function onScanError(error) {
  // Don't show continuous error messages
  console.log('QR scan error:', error);
}

// Update destination info display
function updateDestinationInfo() {
  if (destinationInfoSpan && destination) {
    destinationInfoSpan.textContent = `${destination.name} - ${destination.address}`;
  }
}

// Initialize location tracking
function initializeLocationTracking() {
  if (navigator.geolocation) {
    console.log('Starting automatic location tracking...');
    
    // Get initial location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        updateLocationDisplay();
        
        // Start continuous tracking
        trackUserLocation();
      },
      (error) => {
        console.error('Error getting location:', error);
        showStatus('Could not get your location. Please enable location services.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  } else {
    showStatus('Geolocation not supported by this browser', 'error');
  }
}

// Track user location continuously
function trackUserLocation() {
  if (!navigator.geolocation) return;
  
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      // Update location if it has changed significantly
      if (!userLocation || calculateDistance(userLocation, newLocation) > 0.01) {
        const previousLocation = userLocation;
        userLocation = newLocation;
        
        // Calculate speed if we have a previous location
        if (previousLocation) {
          calculateCurrentSpeed(previousLocation, newLocation);
        }
        
        updateLocationDisplay();
        updateCurrentLocationMarker(newLocation);
        
        // Send location to server
        sendLocationToServer(newLocation);
      }
    },
    (error) => {
      console.error('Error tracking location:', error);
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
  );
  
  // Store watch ID for cleanup
  window.locationWatchId = watchId;
}

// Send location to server
async function sendLocationToServer(location) {
  try {
    const userEmail = localStorage.getItem('userEmail') || 'anonymous';
    
    const response = await fetch('/store-live-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: location.lat,
        longitude: location.lng,
        user_email: userEmail,
        qr_id: currentQRId
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send location to server');
    }
    
    console.log('Location sent to server successfully');
    
  } catch (error) {
    console.error('Error sending location to server:', error);
  }
}

// Start location tracking
function startLocationTracking() {
  if (isTracking) return;
  
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
    return routeTimeInSeconds;
  }
  
  const speedKmH = window.currentSpeed || 10;
  const distanceInKm = distanceInMeters / 1000;
  const timeInHours = distanceInKm / speedKmH;
  const timeInSeconds = timeInHours * 3600;
  
  return Math.round(timeInSeconds);
}

// Calculate current speed based on location changes
function calculateCurrentSpeed(oldLocation, newLocation) {
  const distance = calculateDistance(oldLocation, newLocation); // km
  const timeDifference = 5; // seconds (typical GPS update interval)
  
  if (distance > 0 && timeDifference > 0) {
    const speedKmH = (distance / timeDifference) * 3600; // Convert to km/h
    
    // Only update if speed is reasonable (between 0-120 km/h)
    if (speedKmH >= 0 && speedKmH <= 120) {
      window.currentSpeed = speedKmH;
      updateSpeedDisplay(speedKmH);
      console.log(`Speed updated: ${speedKmH.toFixed(1)} km/h`);
    }
  }
}

// Update speed display in the UI
function updateSpeedDisplay(speedKmH) {
  const currentSpeedElement = document.querySelector('.card-body').children[3]; // Current Speed element
  
  if (currentSpeedElement && currentSpeedElement.textContent.includes('Current Speed:')) {
    const speedColor = speedKmH > 0 ? 'text-warning' : 'text-muted';
    currentSpeedElement.innerHTML = `<strong>Current Speed:</strong> <span class="${speedColor}">${speedKmH.toFixed(1)} km/h</span>`;
  }
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
  
  // Update Location Status panel elements
  const routeDistanceElement = document.querySelector('.card-body').children[1]; // Route Distance element
  const travelTimeElement = document.querySelector('.card-body').children[2]; // Travel Time element
  
  if (routeDistanceElement && routeDistanceElement.textContent.includes('Route Distance:')) {
    routeDistanceElement.innerHTML = `<strong>Route Distance:</strong> <span class="text-info">${distanceKm} km</span>`;
  }
  
  if (travelTimeElement && travelTimeElement.textContent.includes('Travel Time:')) {
    travelTimeElement.innerHTML = `<strong>Travel Time:</strong> <span class="text-success">${timeDisplay}</span>`;
  }
  
  // Also update any other UI elements that might exist
  const travelTimeSpan = document.getElementById('travelTime');
  const distanceSpan = document.getElementById('distance');
  const routeInfoDiv = document.getElementById('routeInfo');
  
  if (travelTimeSpan) {
    travelTimeSpan.textContent = timeDisplay;
  }
  
  if (distanceSpan) {
    distanceSpan.textContent = `${distanceKm} km`;
  }
  
  // Update route information panel if it exists
  if (routeInfoDiv) {
    routeInfoDiv.innerHTML = `
      <div class="row">
        <div class="col-md-4">
          <div class="text-center">
            <h6 class="text-info mb-1">Distance</h6>
            <span class="h5 text-primary">${distanceKm} km</span>
          </div>
        </div>
        <div class="col-md-4">
          <div class="text-center">
            <h6 class="text-info mb-1">Travel Time</h6>
            <span class="h5 text-success">${timeDisplay}</span>
          </div>
        </div>
        <div class="col-md-4">
          <div class="text-center">
            <h6 class="text-info mb-1">Average Speed</h6>
            <span class="h5 text-warning">${(window.currentSpeed || 10).toFixed(1)} km/h</span>
          </div>
        </div>
      </div>
    `;
  }
  
  console.log(`Travel info updated: ${distanceKm} km, ${timeDisplay}`);
}

// Initialize HERE Maps
async function initializeMap() {
  try {
    const API_KEY = 'VivkTzkLRp8BPWqRgV12KUmuOHfy6mobXyHUJSEfOcA';
    console.log('Initializing HERE Maps...');
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialize HERE Maps platform
    platform = new H.service.Platform({ apikey: API_KEY });
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }
    
    // Set proper map container size
    mapContainer.style.height = '500px';
    mapContainer.style.width = '100%';
    
    // Initialize layers
    const defaultLayers = platform.createDefaultLayers();
    
    // Create map
    map = new H.Map(mapContainer, defaultLayers.vector.normal.map, {
      zoom: 10,
      center: { lat: 12.9716, lng: 77.5946 } // Bangalore coordinates
    });
    
    // Enable map interaction
    const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    const ui = H.ui.UI.createDefault(map);
    
    // Force map resize after creation
    setTimeout(() => {
      if (map) {
        map.getViewPort().resize();
      }
    }, 100);
    
    console.log('HERE Maps initialized successfully');
    showStatus('Map loaded successfully', 'success');
    
  } catch (error) {
    console.error('Error initializing HERE Maps:', error);
    showStatus('Map initialization failed', 'error');
  }
}

// Initialize navigation after QR scan
function initializeNavigation() {
  if (!destination || !map) return;
  
  console.log('Initializing navigation to:', destination);
  
  // Clear existing markers
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
  
  // Get current location and set up navigation
  if (userLocation) {
    addCurrentLocationMarker();
    calculateAndDisplayRoute(); // Use real routing instead of direct path
    
    // Fit map to show both locations
    fitMapToMarkers();
  }
}

// Add destination marker
function addDestinationMarker() {
  if (!destination || !map) return;
  
  // Create red destination marker
  const destIcon = new H.map.Icon(
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#dc3545"/></svg>',
    { size: { w: 24, h: 24 } }
  );
  
  destinationMarker = new H.map.Marker(
    { lat: destination.lat, lng: destination.lng },
    { icon: destIcon }
  );
  
  map.addObject(destinationMarker);
  console.log('Destination marker added');
}

// Add current location marker
function addCurrentLocationMarker() {
  if (!userLocation || !map) return;
  
  // Create blue current location marker
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

// Calculate and display route using HERE Maps API
function calculateAndDisplayRoute() {
  if (!userLocation || !destination || !platform) {
    console.log('Missing required data for route calculation');
    displayDirectPath(); // Fallback to direct path
    return;
  }
  
  console.log('Calculating route using HERE Maps API...');
  
  // Get routing service
  const router = platform.getRoutingService(null, 8);
  
  const routeRequestParams = {
    'routingMode': 'fast',
    'transportMode': 'car',
    'origin': `${userLocation.lat},${userLocation.lng}`,
    'destination': `${destination.lat},${destination.lng}`,
    'return': 'polyline,summary,actions'
  };
  
  // Make routing request
  router.calculateRoute(
    routeRequestParams,
    (result) => {
      console.log('Route calculation successful:', result);
      
      if (result.routes && result.routes.length > 0) {
        const route = result.routes[0];
        displayHereRoute(route);
      } else {
        console.log('No routes found, using direct path');
        displayDirectPath();
      }
    },
    (error) => {
      console.error('Route calculation failed:', error);
      console.log('Falling back to direct path');
      displayDirectPath();
    }
  );
}

// Display HERE Maps route
function displayHereRoute(route) {
  console.log('Displaying HERE Maps route');
  
  // Remove existing route
  if (routeGroup) {
    map.removeObject(routeGroup);
  }
  
  // Create route polyline from HERE Maps data
  const section = route.sections[0];
  const polyline = section.polyline;
  
  // Decode the polyline
  const decodedPolyline = H.geo.LineString.fromFlexiblePolyline(polyline);
  
  // Create route line
  const routeLine = new H.map.Polyline(decodedPolyline, {
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
  
  // Get route summary
  const summary = section.summary;
  const distanceInMeters = summary.length;
  const timeInSeconds = summary.duration;
  
  console.log('Route summary:', {
    distance: `${(distanceInMeters/1000).toFixed(1)} km`,
    time: `${Math.round(timeInSeconds/60)} minutes`
  });
  
  // Update travel time display with real route data
  updateTravelTimeDisplay(timeInSeconds, distanceInMeters);
  
  // Fit map to show the route
  fitMapToRoute();
  
  showStatus(`Road route: ${(distanceInMeters/1000).toFixed(1)} km, ${Math.round(timeInSeconds/60)} min`, 'success');
}

// Display direct path as fallback
function displayDirectPath() {
  if (!userLocation || !destination || !map) return;
  
  console.log('Drawing direct path between locations');
  
  // Remove existing route
  if (routeGroup) {
    map.removeObject(routeGroup);
  }
  
  // Create direct line
  const lineString = new H.geo.LineString();
  lineString.pushPoint(userLocation.lat, userLocation.lng);
  lineString.pushPoint(destination.lat, destination.lng);
  
  // Create blue route line
  const routeLine = new H.map.Polyline(lineString, {
    style: {
      strokeColor: '#007bff',
      lineWidth: 6,
      lineCap: 'round',
      lineJoin: 'round',
      lineDash: [10, 5] // Dashed line to indicate direct path
    }
  });
  
  // Add route to map
  routeGroup = new H.map.Group();
  routeGroup.addObject(routeLine);
  map.addObject(routeGroup);
  
  // Calculate and display travel info
  const distance = calculateDistance(userLocation, destination);
  const estimatedTime = calculateTravelTime(distance * 1000);
  
  updateTravelTimeDisplay(estimatedTime, distance * 1000);
  
  console.log('Direct path displayed successfully');
  showStatus(`Direct route: ${distance.toFixed(1)} km (estimated)`, 'success');
}

// Fit map to show both markers
function fitMapToMarkers() {
  if (!map || !currentLocationMarker || !destinationMarker) return;
  
  try {
    const group = new H.map.Group();
    group.addObject(currentLocationMarker);
    group.addObject(destinationMarker);
    
    map.getViewModel().setLookAtData({
      bounds: group.getBoundingBox(),
      padding: 50
    });
  } catch (error) {
    console.error('Error fitting map bounds:', error);
  }
}

// Fit map to show the entire route
function fitMapToRoute() {
  if (!map || !routeGroup) return;
  
  try {
    map.getViewModel().setLookAtData({
      bounds: routeGroup.getBoundingBox(),
      padding: 50
    });
  } catch (error) {
    console.error('Error fitting map to route:', error);
    fitMapToMarkers(); // Fallback to marker-based fitting
  }
}

// Update current location marker
function updateCurrentLocationMarker(newLocation) {
  if (!map) return;
  
  if (currentLocationMarker) {
    map.removeObject(currentLocationMarker);
  }
  
  userLocation = newLocation;
  addCurrentLocationMarker();
  
  // Update route if destination exists
  if (destination) {
    calculateAndDisplayRoute(); // Use real routing
  }
}

// Update location display
function updateLocationDisplay() {
  if (currentLocationSpan && userLocation) {
    currentLocationSpan.textContent = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
  }
}

// Make functions available globally
window.processManualQRData = processManualQRData;
window.loadSampleQRData = loadSampleQRData;
window.testSampleLocation = testSampleLocation;

console.log('QR Scanner script loaded successfully');