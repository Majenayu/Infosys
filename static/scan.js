// QR Scanner and Navigation functionality
const API_KEY = 'YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI';
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
const trackLocationBtn = document.getElementById('trackLocationBtn');
const currentLocationSpan = document.getElementById('currentLocation');
const destinationInfoSpan = document.getElementById('destinationInfo');
const trackingStatusSpan = document.getElementById('trackingStatus');
const routeInfoDiv = document.getElementById('routeInfo');

// Initialize HERE Maps
const initializeMap = () => {
  try {
    platform = new H.service.Platform({ apikey: API_KEY });
    defaultLayers = platform.createDefaultLayers();
    routingService = platform.getRoutingService(null, 8);

    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
      throw new Error('Map container not found');
    }

    // Initialize map centered on Karnataka
    map = new H.Map(mapContainer, defaultLayers.vector.normal.map, {
      zoom: 7,
      center: { lat: 15.3173, lng: 75.7139 }
    });

    // Enable map events and behaviors
    const mapEvents = new H.mapevents.MapEvents(map);
    const behavior = new H.mapevents.Behavior(mapEvents);
    ui = H.ui.UI.createDefault(map);

    // Resize map when window resizes
    window.addEventListener('resize', () => {
      if (map) {
        map.getViewPort().resize();
      }
    });

    console.log('Scanner map initialized successfully');
    showStatus('Scanner ready. Start camera to scan QR codes.', 'success');
  } catch (error) {
    console.error('Failed to initialize map:', error);
    showStatus('Map initialization failed. Please refresh the page.', 'error');
  }
};

// Initialize QR Code Scanner
const initializeScanner = () => {
  try {
    html5QrcodeScanner = new Html5Qrcode("reader");
    console.log('QR Scanner initialized');
  } catch (error) {
    console.error('Failed to initialize QR scanner:', error);
    showStatus('QR Scanner initialization failed', 'error');
  }
};

// Start QR Code Scanning
const startScanning = async () => {
  if (!html5QrcodeScanner || isScanning) return;

  try {
    startScanBtn.disabled = true;
    startScanBtn.textContent = '🔄 Starting Camera...';

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanError
    );

    isScanning = true;
    startScanBtn.textContent = '📹 Camera Active';
    stopScanBtn.disabled = false;
    showStatus('Camera started. Point at a QR code to scan.', 'success');
  } catch (error) {
    console.error('Failed to start scanning:', error);
    showStatus('Failed to start camera. Please check permissions.', 'error');
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

      // Update destination info
      destinationInfoSpan.textContent = `${destination.name} - ${destination.address}`;
      
      // Show destination on map
      showDestinationOnMap(destination);
      
      // Start location tracking automatically
      startLocationTracking();
      
      // Stop scanning after successful scan
      stopScanning();
      
      showStatus(`QR code scanned successfully! Destination: ${destination.name}`, 'success');
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

// Show destination on map
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
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
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

// Calculate route between user and destination
const calculateRoute = (from, to) => {
  if (!routingService) return;

  const routingParams = {
    mode: 'fastest;car',
    representation: 'display',
    waypoint0: `geo!${from.lat},${from.lng}`,
    waypoint1: `geo!${to.lat},${to.lng}`,
    routeattributes: 'summary'
  };

  routingService.calculateRoute(routingParams, (result) => {
    if (routeLine) {
      map.removeObject(routeLine);
    }

    if (!result.response.route || result.response.route.length === 0) {
      console.warn('No route found');
      return;
    }

    const route = result.response.route[0];
    const lineString = new H.geo.LineString();

    // Build route line
    route.shape.forEach(point => {
      const [lat, lng] = point.split(',');
      lineString.pushLatLngAlt(parseFloat(lat), parseFloat(lng), 0);
    });

    // Create route polyline
    routeLine = new H.map.Polyline(lineString, {
      style: { 
        strokeColor: '#007bff', 
        lineWidth: 5,
        lineDash: [0, 2]
      }
    });

    map.addObject(routeLine);

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
    const group = new H.map.Group();
    group.addObject(userMarker);
    group.addObject(destinationMarker);
    group.addObject(routeLine);
    map.getViewModel().setLookAtData({ bounds: group.getBoundingBox() });

  }, (error) => {
    console.error('Route calculation error:', error);
    showStatus('Failed to calculate route', 'error');
  });
};

// Send live location to server
const sendLiveLocation = async (locationData) => {
  try {
    const response = await fetch('/live-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(locationData)
    });

    if (!response.ok) {
      throw new Error('Failed to send location');
    }

    console.log('Live location sent successfully');
  } catch (error) {
    console.error('Failed to send live location:', error);
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('QR Scanner initializing...');
  
  // Initialize components
  initializeMap();
  initializeScanner();
  
  // Setup event listeners
  if (startScanBtn) {
    startScanBtn.addEventListener('click', startScanning);
  }
  
  if (stopScanBtn) {
    stopScanBtn.addEventListener('click', stopScanning);
  }
  
  if (trackLocationBtn) {
    trackLocationBtn.addEventListener('click', startLocationTracking);
  }
  
  console.log('QR Scanner initialized successfully');
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

// Window load backup
window.addEventListener('load', () => {
  if (!map) {
    console.log('Backup map initialization...');
    initializeMap();
  }
  
  // Ensure map is properly sized
  setTimeout(() => {
    if (map) {
      map.getViewPort().resize();
    }
  }, 500);
});