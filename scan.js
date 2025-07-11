// QR Code Scanner with file browsing and HERE Maps navigation
let platform, map, searchService, routingService;
let html5QrcodeScanner = null;
let userMarker = null, destinationMarker = null, routeLine = null;
let isTracking = false;
let trackingInterval = null;
let userLocation = null;
let destination = null;

// HERE Maps API Key  
const API_KEY = "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI";

// DOM Elements
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const trackLocationBtn = document.getElementById('trackLocationBtn');
const currentLocationSpan = document.getElementById('currentLocation');
const destinationInfoSpan = document.getElementById('destinationInfo');
const trackingStatusSpan = document.getElementById('trackingStatus');
const routeInfoDiv = document.getElementById('routeInfo');
const qrFileInput = document.getElementById('qrFileInput');
const processFileBtn = document.getElementById('processFileBtn');
const testSampleBtn = document.getElementById('testSampleBtn');

// Initialize HERE Maps
const initializeMap = () => {
  try {
    platform = new H.service.Platform({
      apikey: API_KEY
    });

    const defaultLayers = platform.createDefaultLayers({
      tileSize: 512,
      ppi: 320
    });

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }

    map = new H.Map(
      mapContainer,
      defaultLayers.raster.normal.map,
      {
        zoom: 6,
        center: { lat: 20.5937, lng: 78.9629 } // Center on India
      }
    );

    // Enable map interaction
    const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    const ui = H.ui.UI.createDefault(map, defaultLayers);
    
    // Initialize services
    searchService = platform.getSearchService();
    routingService = platform.getRoutingService();

    // Resize map when window resizes
    window.addEventListener('resize', () => {
      if (map) {
        map.getViewPort().resize();
      }
    });

    console.log('Scanner map initialized successfully');
  } catch (error) {
    console.error('Failed to initialize map:', error);
    showStatus('Map initialization failed', 'error');
  }
};

// Check camera support
const checkCameraSupport = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API not supported - using manual input only');
      return false;
    }
    
    // Skip device enumeration as it may fail in some environments
    // Instead, try to request camera access directly
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      testStream.getTracks().forEach(track => track.stop());
      console.log('Camera access confirmed');
      return true;
    } catch (accessError) {
      console.warn('Camera access test failed:', accessError.message);
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
    // Check camera support first
    const cameraSupported = await checkCameraSupport();
    if (!cameraSupported) {
      startScanBtn.disabled = true;
      startScanBtn.textContent = '⚠️ Camera Not Available';
      showStatus('Camera not available. Use file upload or manual input.', 'error');
      return;
    }
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    console.log('QR Scanner initialized successfully');
    showStatus('QR Scanner ready. Click "Start Camera" to begin.', 'success');
  } catch (error) {
    console.error('Failed to initialize QR scanner:', error);
    showStatus('QR Scanner initialization failed. Use file upload.', 'error');
    startScanBtn.disabled = true;
    startScanBtn.textContent = '⚠️ Scanner Error';
  }
};

// Start QR code scanning
const startScanning = async () => {
  if (!html5QrcodeScanner) {
    showStatus('Scanner not initialized', 'error');
    return;
  }

  try {
    const config = {
      fps: 10,
      qrbox: { width: 300, height: 300 },
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };

    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    );

    startScanBtn.disabled = true;
    stopScanBtn.disabled = false;
    showStatus('Camera scanning started', 'success');
  } catch (error) {
    console.error('Failed to start scanning:', error);
    showStatus('Failed to start camera. Try file upload instead.', 'error');
  }
};

// Stop QR code scanning
const stopScanning = async () => {
  if (!html5QrcodeScanner) return;

  try {
    await html5QrcodeScanner.stop();
    startScanBtn.disabled = false;
    stopScanBtn.disabled = true;
    showStatus('Camera scanning stopped', 'info');
  } catch (error) {
    console.error('Failed to stop scanning:', error);
  }
};

// Handle successful QR scan
const onScanSuccess = (decodedText, decodedResult) => {
  console.log('QR Code scanned:', decodedText);
  processQRData(decodedText);
  stopScanning(); // Auto-stop after successful scan
};

// Handle scan failures (called frequently, so we keep it minimal)
const onScanFailure = (error) => {
  // Ignore frequent scan failures to avoid console spam
};

// Process QR data from any source
const processQRData = (qrData) => {
  try {
    let locationData;
    
    // Try to parse as JSON first
    try {
      locationData = JSON.parse(qrData);
    } catch (parseError) {
      // If JSON parsing fails, treat as plain text coordinates
      const coordMatch = qrData.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coordMatch) {
        locationData = {
          name: 'Scanned Location',
          address: qrData,
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2])
        };
      } else {
        throw new Error('Invalid QR data format');
      }
    }

    // Validate required fields
    if (!locationData.latitude || !locationData.longitude) {
      throw new Error('QR code missing location coordinates');
    }

    // Set destination
    destination = {
      lat: locationData.latitude,
      lng: locationData.longitude,
      name: locationData.name || 'Destination',
      address: locationData.address || 'Unknown address'
    };

    // Update UI
    destinationInfoSpan.textContent = `${destination.name} (${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)})`;

    // Add destination marker to map
    addDestinationMarker(destination);

    // If user location is available, calculate route
    if (userLocation) {
      calculateRoute(userLocation, destination);
    }

    showStatus('QR code processed successfully!', 'success');
  } catch (error) {
    console.error('QR processing error:', error);
    showStatus(`Invalid QR code: ${error.message}`, 'error');
  }
};

// Process QR image file
const processQRFile = () => {
  const file = qrFileInput.files[0];
  if (!file) {
    showStatus('Please select an image file', 'error');
    return;
  }

  if (!file.type.startsWith('image/')) {
    showStatus('Please select a valid image file', 'error');
    return;
  }

  try {
    const html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.scanFile(file, true)
      .then(decodedText => {
        console.log('QR code from file:', decodedText);
        processQRData(decodedText);
        showStatus('QR code read from image!', 'success');
      })
      .catch(error => {
        console.error('File scan error:', error);
        showStatus('Could not read QR code from image', 'error');
      });
  } catch (error) {
    console.error('File processing error:', error);
    showStatus('Error processing image file', 'error');
  }
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
    timestamp: new Date().toISOString()
  });
  
  processQRData(sampleQRData);
  showStatus('Sample location loaded successfully!', 'success');
};

// Add destination marker to map
const addDestinationMarker = (destination) => {
  if (!map) return;

  // Remove existing destination marker
  if (destinationMarker) {
    map.removeObject(destinationMarker);
  }

  // Create destination marker
  const destIconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#28a745" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
    </svg>
  `;
  
  const destIcon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(destIconMarkup));
  destinationMarker = new H.map.Marker({ lat: destination.lat, lng: destination.lng }, { icon: destIcon });
  
  map.addObject(destinationMarker);
  map.setCenter({ lat: destination.lat, lng: destination.lng });
  map.setZoom(12);
};

// Start location tracking
const startLocationTracking = () => {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported', 'error');
    return;
  }

  if (isTracking) {
    stopLocationTracking();
    return;
  }

  // Update button
  trackLocationBtn.textContent = '🛑 Stop Tracking';
  trackLocationBtn.classList.remove('btn-primary');
  trackLocationBtn.classList.add('btn-danger');
  
  isTracking = true;
  trackingStatusSpan.textContent = 'Active';
  trackingStatusSpan.className = 'text-success';

  // Get initial position
  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateUserLocation(position);
      showStatus('Location tracking started', 'success');
      
      // Start continuous tracking
      trackingInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          updateUserLocation,
          (error) => console.warn('Location update failed:', error),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
        );
      }, 3000); // Update every 3 seconds
    },
    (error) => {
      console.error('Initial location error:', error);
      showStatus('Failed to get location', 'error');
      stopLocationTracking();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
};

// Stop location tracking
const stopLocationTracking = () => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
  isTracking = false;
  trackingStatusSpan.textContent = 'Inactive';
  trackingStatusSpan.className = 'text-muted';
  
  trackLocationBtn.textContent = '🎯 Enable Location Tracking';
  trackLocationBtn.classList.remove('btn-danger');
  trackLocationBtn.classList.add('btn-primary');
  
  showStatus('Location tracking stopped', 'info');
};

// Update user location
const updateUserLocation = (position) => {
  const coords = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };

  userLocation = coords;
  currentLocationSpan.textContent = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;

  // Add or update user marker
  if (!map) return;

  if (userMarker) {
    map.removeObject(userMarker);
  }

  // Create user location marker
  const userIconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#007bff" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="#007bff"/>
      <circle cx="12" cy="12" r="4" fill="#ffffff"/>
    </svg>
  `;
  
  const userIcon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(userIconMarkup));
  userMarker = new H.map.Marker(coords, { icon: userIcon });
  
  map.addObject(userMarker);

  // Send location to server
  sendLiveLocation(coords);

  // Update route if destination exists
  if (destination) {
    calculateRoute(userLocation, destination);
  }
};

// Send live location to server
const sendLiveLocation = async (location) => {
  try {
    const response = await fetch('/live-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: location.lat,
        longitude: location.lng
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send location');
    }

    console.log('Live location sent successfully');
  } catch (error) {
    console.error('Failed to send live location:', error);
  }
};

// Calculate route between user and destination
const calculateRoute = (from, to) => {
  if (!routingService || !map) {
    console.warn('Routing service or map not available');
    return;
  }

  try {
    const routingParams = {
      'waypoint0': `geo!${from.lat},${from.lng}`,
      'waypoint1': `geo!${to.lat},${to.lng}`,
      'mode': 'fastest;car',
      'representation': 'display',
      'routeattributes': 'summary,shape'
    };

    routingService.calculateRoute(routingParams, (result) => {
      try {
        if (routeLine) {
          map.removeObject(routeLine);
        }

        if (!result.response || !result.response.route || result.response.route.length === 0) {
          console.warn('No route found in response');
          routeInfoDiv.innerHTML = '<p class="text-warning">No route available between locations</p>';
          return;
        }

        const route = result.response.route[0];
        const lineString = new H.geo.LineString();

        // Build route line from shape
        if (route.shape) {
          route.shape.forEach(point => {
            const [lat, lng] = point.split(',');
            lineString.pushLatLngAlt(parseFloat(lat), parseFloat(lng), 0);
          });

          // Create route polyline
          routeLine = new H.map.Polyline(lineString, {
            style: { 
              strokeColor: '#007bff', 
              lineWidth: 4,
              lineDash: [0, 2]
            }
          });

          map.addObject(routeLine);
        }

        // Update route information
        if (route.summary) {
          const distance = (route.summary.distance / 1000).toFixed(2);
          const time = Math.round(route.summary.travelTime / 60);
          
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

      } catch (routeError) {
        console.error('Route processing error:', routeError);
        routeInfoDiv.innerHTML = '<p class="text-danger">Error processing route</p>';
      }

    }, (error) => {
      console.error('Route calculation error:', error);
      routeInfoDiv.innerHTML = '<p class="text-danger">Route calculation failed</p>';
    });
  } catch (error) {
    console.error('Route setup error:', error);
    routeInfoDiv.innerHTML = '<p class="text-danger">Route service unavailable</p>';
  }
};

// Show status messages
const showStatus = (message, type) => {
  const alertElement = document.getElementById('statusAlert');
  const messageElement = document.getElementById('statusMessage');
  
  if (!alertElement || !messageElement) {
    console.log(`Status: ${message} (${type})`);
    return;
  }
  
  // Set message and type
  messageElement.textContent = message;
  alertElement.className = `alert alert-${type === 'error' ? 'danger' : type === 'info' ? 'info' : 'success'} alert-dismissible fade show`;
  
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

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('QR Scanner Navigator initialized');
  
  // Initialize map first
  initializeMap();
  
  // Initialize QR scanner
  await initializeScanner();
  
  // Set up event listeners
  if (startScanBtn) {
    startScanBtn.addEventListener('click', startScanning);
  }
  
  if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopScanning);
  }
  
  if (trackLocationBtn) {
    trackLocationBtn.addEventListener('click', startLocationTracking);
  }
  
  if (processFileBtn) {
    processFileBtn.addEventListener('click', processQRFile);
  }
  
  if (testSampleBtn) {
    testSampleBtn.addEventListener('click', testSampleLocation);
  }
  
  console.log('QR Scanner initialization complete');
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (isTracking) {
    stopLocationTracking();
  }
  if (html5QrcodeScanner) {
    stopScanning();
  }
});