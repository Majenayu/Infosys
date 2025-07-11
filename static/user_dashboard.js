// User Dashboard JavaScript

class UserDashboard {
  constructor() {
    this.init();
  }

  init() {
    this.loadUserData();
    this.bindEvents();
    this.checkAuthentication();
  }

  checkAuthentication() {
    const isLoggedIn = localStorage.getItem('userLoggedIn');
    const userData = localStorage.getItem('userData');
    
    if (!isLoggedIn || !userData) {
      // Redirect to login page if not authenticated
      window.location.href = '/user';
      return;
    }
  }

  loadUserData() {
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        
        // Update UI with user data
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userPhone = document.getElementById('userPhone');
        
        if (userName) userName.textContent = user.name || 'User';
        if (userEmail) userEmail.textContent = user.email || '';
        if (userPhone) userPhone.textContent = user.phone || '';
        
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }

  bindEvents() {
    const qrCodeForm = document.getElementById('qrCodeForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const qrCodeInput = document.getElementById('qrCodeInput');
    
    if (qrCodeForm) {
      qrCodeForm.addEventListener('submit', (e) => this.handleQRCodeSubmit(e));
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    if (qrCodeInput) {
      // Only allow numeric input and limit to 4 digits
      qrCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
      });
    }
  }

  async handleQRCodeSubmit(event) {
    event.preventDefault();
    
    const qrCodeInput = document.getElementById('qrCodeInput');
    const qrCode = qrCodeInput.value.trim();
    
    if (!qrCode || qrCode.length !== 4) {
      this.showMessage('Please enter a valid 4-digit code', 'error');
      return;
    }

    if (!/^\d{4}$/.test(qrCode)) {
      this.showMessage('QR code must be exactly 4 digits', 'error');
      return;
    }

    try {
      // Get tracking data for the QR code
      const response = await fetch(`/api/qr-tracking/${qrCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        // Check if we have both coordinates for map display
        if (data.coordinate_A && data.coordinate_B) {
          this.showMessage('QR code found! Loading tracking information...', 'success');
          
          // Store QR code in localStorage for tracking history
          localStorage.setItem('trackingQRCode', qrCode);
          
          // Add to tracking history
          this.addToTrackingHistory(qrCode, data);
          
          // Display tracking results with map
          this.displayTrackingResults(data);
        } else {
          // This shouldn't happen with our new API, but just in case
          this.showMessage('QR code found but incomplete data', 'warning');
        }
      } else {
        // Handle specific error messages
        if (data.message === 'No delivery boy assigned') {
          this.showMessage('No delivery boy assigned', 'warning');
          this.showNoDeliveryBoyMessage(qrCode);
        } else if (data.message === 'No item exists') {
          this.showMessage('No item exists', 'error');
          this.showNoItemMessage();
        } else {
          this.showMessage(data.message || 'QR code not found in system', 'error');
        }
      }
    } catch (error) {
      console.error('QR code lookup error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  displayTrackingResults(trackingData) {
    // Show tracking results section
    const trackingResults = document.getElementById('trackingResults');
    trackingResults.style.display = 'block';
    
    // Check if we have both coordinates for map display
    if (trackingData.coordinate_A && trackingData.coordinate_B) {
      // Display map with both coordinates
      this.showMapWithBothCoordinates(trackingData);
      
      // Update delivery status
      const statusIndicator = document.getElementById('statusIndicator');
      const deliveryStatus = document.getElementById('deliveryStatus');
      const lastUpdated = document.getElementById('lastUpdated');
      
      if (statusIndicator) {
        statusIndicator.className = 'status-indicator active';
        statusIndicator.textContent = '🚚';
      }
      
      if (deliveryStatus) {
        deliveryStatus.textContent = `Driver assigned: ${trackingData.coordinate_B.delivery_partner_name}`;
      }
      
      if (lastUpdated) {
        lastUpdated.textContent = `Last updated: ${new Date(trackingData.last_updated).toLocaleString()}`;
      }
      
      // Update location status panel
      this.updateLocationStatusPanel(trackingData);
      
    } else if (trackingData.coordinate_A && !trackingData.coordinate_B) {
      // Show "No delivery boy assigned" message
      const trackingResults = document.getElementById('trackingResults');
      trackingResults.innerHTML = `
        <div class="alert alert-warning">
          <h5>No Delivery Boy Assigned</h5>
          <p>QR Code: ${trackingData.qr_id}</p>
          <p>Destination: ${trackingData.coordinate_A.name}</p>
          <p>Address: ${trackingData.coordinate_A.address}</p>
          <p>Status: Waiting for delivery partner assignment</p>
        </div>
      `;
      
    } else {
      // Show "No item exists" message
      const trackingResults = document.getElementById('trackingResults');
      trackingResults.innerHTML = `
        <div class="alert alert-danger">
          <h5>No Item Exists</h5>
          <p>QR Code not found or not activated</p>
        </div>
      `;
    }
  }

  showNoDeliveryBoyMessage(qrCode) {
    const trackingResults = document.getElementById('trackingResults');
    if (trackingResults) {
      trackingResults.style.display = 'block';
      trackingResults.innerHTML = `
        <div class="alert alert-warning">
          <h5>No Delivery Boy Assigned</h5>
          <p>QR Code: <strong>${qrCode}</strong></p>
          <p>Status: Waiting for delivery partner assignment</p>
          <p>The destination has been set, but no delivery partner has been assigned yet.</p>
        </div>
      `;
    }
  }

  showNoItemMessage() {
    const trackingResults = document.getElementById('trackingResults');
    if (trackingResults) {
      trackingResults.style.display = 'block';
      trackingResults.innerHTML = `
        <div class="alert alert-danger">
          <h5>No Item Exists</h5>
          <p>QR Code not found or not activated in the system</p>
          <p>Please check the QR code and try again</p>
        </div>
      `;
    }
  }

  showMapWithBothCoordinates(trackingData) {
    // Initialize HERE Maps and display both coordinates
    this.initializeTrackingMap(trackingData);
    
    // Update delivery status
    const statusIndicator = document.getElementById('statusIndicator');
    const deliveryStatus = document.getElementById('deliveryStatus');
    const lastUpdated = document.getElementById('lastUpdated');
    
    if (trackingData.delivery_status === 'driver_assigned') {
      statusIndicator.className = 'status-indicator status-assigned';
      deliveryStatus.textContent = 'Driver Assigned - En Route';
      if (trackingData.last_updated) {
        const updateTime = new Date(trackingData.last_updated).toLocaleString();
        lastUpdated.textContent = `Last updated: ${updateTime}`;
      }
      
      // Show driver section
      const driverSection = document.getElementById('driverSection');
      const driverInfo = document.getElementById('driverInfo');
      const driverLocation = document.getElementById('driverLocation');
      
      driverSection.style.display = 'block';
      driverInfo.textContent = trackingData.driver_info?.email || 'Driver assigned';
      
      if (trackingData.driver_location) {
        driverLocation.textContent = `Lat: ${trackingData.driver_location.latitude.toFixed(4)}, Lng: ${trackingData.driver_location.longitude.toFixed(4)}`;
      }
    } else if (trackingData.delivery_status === 'nobody_received') {
      statusIndicator.className = 'status-indicator status-error';
      deliveryStatus.textContent = 'Nobody received the item or courier';
      lastUpdated.textContent = 'No delivery partner has scanned this QR code';
      
      // Hide driver section
      document.getElementById('driverSection').style.display = 'none';
    } else {
      statusIndicator.className = 'status-indicator status-no-driver';
      deliveryStatus.textContent = 'No Driver Assigned';
      lastUpdated.textContent = 'Waiting for driver assignment';
      
      // Hide driver section
      document.getElementById('driverSection').style.display = 'none';
    }
    
    // Update destination info
    document.getElementById('destinationName').textContent = trackingData.destination.name || 'Unknown Location';
    document.getElementById('destinationAddress').textContent = trackingData.destination.address || 'Address not available';
    
    // Show and update location status panel
    this.updateLocationStatusPanel(trackingData);
    
    // Initialize map
    this.initializeTrackingMap(trackingData);
  }

  async initializeTrackingMap(trackingData) {
    try {
      // Get HERE Maps API keys
      const keysResponse = await fetch('/api/here-keys');
      const keysData = await keysResponse.json();
      const apiKey = keysData.keys[0]; // Use primary API key
      
      // Initialize HERE Maps platform
      const platform = new H.service.Platform({
        'apikey': apiKey
      });
      
      // Get default map layers
      const defaultLayers = platform.createDefaultLayers();
      
      // Initialize the map
      const mapContainer = document.getElementById('trackingMap');
      if (!mapContainer) {
        console.error('Map container not found');
        return;
      }
      
      // Get coordinates from tracking data
      const destLat = trackingData.coordinate_A.latitude;
      const destLng = trackingData.coordinate_A.longitude;
      const deliveryLat = trackingData.coordinate_B.latitude;
      const deliveryLng = trackingData.coordinate_B.longitude;
      
      // Create the map centered between both coordinates
      const centerLat = (destLat + deliveryLat) / 2;
      const centerLng = (destLng + deliveryLng) / 2;
      
      const map = new H.Map(
        mapContainer,
        defaultLayers.vector.normal.map,
        {
          zoom: 12,
          center: { lat: centerLat, lng: centerLng }
        }
      );
      
      // Add map behavior and UI
      const behavior = new H.mapevents.Behavior();
      const ui = new H.ui.UI(map, defaultLayers);
      
      // Create destination marker (red)
      const destMarker = new H.map.Marker(
        { lat: destLat, lng: destLng },
        { 
          icon: new H.map.Icon('https://img.icons8.com/color/48/000000/marker.png', {size: {w: 32, h: 32}}) 
        }
      );
      
      // Create delivery partner marker (blue)
      const deliveryMarker = new H.map.Marker(
        { lat: deliveryLat, lng: deliveryLng },
        { 
          icon: new H.map.Icon('https://img.icons8.com/color/48/000000/delivery-truck.png', {size: {w: 32, h: 32}}) 
        }
      );
      
      // Add markers to map
      map.addObject(destMarker);
      map.addObject(deliveryMarker);
      
      // Create route between the two points
      const routingService = platform.getRoutingService();
      const routingParameters = {
        'routingMode': 'fast',
        'transportMode': 'car',
        'origin': `${deliveryLat},${deliveryLng}`,
        'destination': `${destLat},${destLng}`,
        'return': 'polyline'
      };
      
      routingService.calculateRoute(routingParameters, (result) => {
        if (result.routes && result.routes.length > 0) {
          const route = result.routes[0];
          const routeShape = route.sections[0].polyline;
          
          // Create polyline for the route
          const linestring = H.geo.LineString.fromFlexiblePolyline(routeShape);
          const polyline = new H.map.Polyline(linestring, {
            style: { strokeColor: '#007bff', lineWidth: 6 }
          });
          
          // Add route to map
          map.addObject(polyline);
        }
      }, (error) => {
        console.warn('Route calculation failed, showing direct path');
        
        // Create direct path line
        const linestring = new H.geo.LineString();
        linestring.pushPoint({ lat: deliveryLat, lng: deliveryLng });
        linestring.pushPoint({ lat: destLat, lng: destLng });
        
        const polyline = new H.map.Polyline(linestring, {
          style: { strokeColor: '#007bff', lineWidth: 6 }
        });
        
        map.addObject(polyline);
      });
      
      // Fit the map to show both markers
      const bbox = new H.geo.Rect(
        Math.max(destLat, deliveryLat) + 0.01,
        Math.min(destLng, deliveryLng) - 0.01,
        Math.min(destLat, deliveryLat) - 0.01,
        Math.max(destLng, deliveryLng) + 0.01
      );
      map.getViewPort().resize();
      map.getViewPort().setViewBounds(bbox);
      
      // Calculate distance and display
      const distance = this.calculateDistance(
        { lat: destLat, lng: destLng },
        { lat: deliveryLat, lng: deliveryLng }
      );
      
      // Update location status panel
      this.updateLocationStatusPanel(trackingData, distance);
      
      console.log('Tracking map initialized successfully');
      
    } catch (error) {
      console.error('Error initializing tracking map:', error);
      this.showMessage('Map initialization failed', 'error');
    }
  }
      // Initialize platform
      const platform = new H.service.Platform({
        'apikey': apiKey
      });
      
      // Initialize map
      const defaultMapTypes = platform.createDefaultMapTypes();
      const mapContainer = document.getElementById('trackingMap');
      
      // Clear any existing content
      mapContainer.innerHTML = '';
      
      const map = new H.Map(
        mapContainer,
        defaultMapTypes.vector.normal.map,
        {
          zoom: 12,
          center: trackingData.destination.coordinates
        }
      );
      
      // Enable map interaction
      const behavior = new H.mapevents.Behavior();
      const ui = new H.ui.UI.createDefault(map, defaultMapTypes);
      
      // Add destination marker (red)
      const destinationMarker = new H.map.Marker(trackingData.destination.coordinates, {
        icon: new H.map.Icon('https://maps.google.com/mapfiles/ms/icons/red-dot.png', {size: {w: 32, h: 32}})
      });
      
      map.addObject(destinationMarker);
      
      // Add driver marker if available (blue)
      if (trackingData.delivery_status === 'driver_assigned' && trackingData.driver_location) {
        const driverMarker = new H.map.Marker(trackingData.driver_location, {
          icon: new H.map.Icon('https://maps.google.com/mapfiles/ms/icons/blue-dot.png', {size: {w: 32, h: 32}})
        });
        
        map.addObject(driverMarker);
        
        // Create a group to fit both markers in view
        const group = new H.map.Group();
        group.addObject(destinationMarker);
        group.addObject(driverMarker);
        map.getViewPort().setViewBounds(group.getBoundingBox());
      } else {
        // Center on destination only
        map.getViewPort().setCenter(trackingData.destination.coordinates);
        map.getViewPort().setZoom(15);
      }
      
      console.log('Tracking map initialized successfully');
      
    } catch (error) {
      console.error('Error initializing tracking map:', error);
      document.getElementById('trackingMap').innerHTML = '<div style="text-align: center; padding: 20px;">Map unavailable</div>';
    }
  }

  addToTrackingHistory(qrCode, data) {
    try {
      let history = JSON.parse(localStorage.getItem('trackingHistory') || '[]');
      
      const newEntry = {
        qrCode: qrCode,
        locationName: data.destination?.name || data.location_name || 'Unknown Location',
        deliveryStatus: data.delivery_status || 'unknown',
        timestamp: new Date().toISOString(),
        address: data.address || ''
      };
      
      // Add to beginning of array and keep only last 5 entries
      history.unshift(newEntry);
      history = history.slice(0, 5);
      
      localStorage.setItem('trackingHistory', JSON.stringify(history));
      this.updateTrackingHistoryUI();
      
    } catch (error) {
      console.error('Error updating tracking history:', error);
    }
  }

  updateTrackingHistoryUI() {
    const historyContainer = document.getElementById('trackingHistory');
    if (!historyContainer) return;
    
    try {
      const history = JSON.parse(localStorage.getItem('trackingHistory') || '[]');
      
      if (history.length === 0) {
        historyContainer.innerHTML = '<p class="text-muted text-center">No recent tracking history available</p>';
        return;
      }
      
      const historyHTML = history.map(entry => `
        <div class="border-bottom py-2">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>QR: ${entry.qrCode}</strong>
              <div class="text-muted small">${entry.locationName}</div>
              ${entry.address ? `<div class="text-muted small">${entry.address}</div>` : ''}
            </div>
            <div class="text-end">
              <small class="text-muted">${new Date(entry.timestamp).toLocaleDateString()}</small>
              <br>
              <button class="btn btn-sm btn-outline-primary" onclick="window.location.href='/scan?qr=${entry.qrCode}'">
                Track Again
              </button>
            </div>
          </div>
        </div>
      `).join('');
      
      historyContainer.innerHTML = historyHTML;
      
    } catch (error) {
      console.error('Error updating tracking history UI:', error);
      historyContainer.innerHTML = '<p class="text-muted text-center">Error loading tracking history</p>';
    }
  }

  handleLogout() {
    // Clear user data
    localStorage.removeItem('userData');
    localStorage.removeItem('userLoggedIn');
    localStorage.removeItem('trackingQRCode');
    localStorage.removeItem('trackingData');
    
    this.showMessage('Logged out successfully!', 'success');
    
    // Redirect to login page
    setTimeout(() => {
      window.location.href = '/user';
    }, 1000);
  }

  updateLocationStatusPanel(trackingData, distance = null) {
    const panel = document.getElementById('locationStatusPanel');
    if (!panel) return;
    
    panel.style.display = 'block';
    
    // Update current location coordinates using new structure
    if (trackingData.coordinate_B) {
      const coords = `${trackingData.coordinate_B.latitude.toFixed(6)}, ${trackingData.coordinate_B.longitude.toFixed(6)}`;
      const coordsElement = document.getElementById('currentLocationCoords');
      if (coordsElement) coordsElement.textContent = coords;
    } else {
      const coordsElement = document.getElementById('currentLocationCoords');
      if (coordsElement) coordsElement.textContent = '--';
    }
    
    // Calculate and display route distance if both locations available
    if (trackingData.coordinate_A && trackingData.coordinate_B) {
      if (!distance) {
        distance = this.calculateDistance(
          { lat: trackingData.coordinate_A.latitude, lng: trackingData.coordinate_A.longitude },
          { lat: trackingData.coordinate_B.latitude, lng: trackingData.coordinate_B.longitude }
        );
      }
      
      const distanceElement = document.getElementById('routeDistance');
      if (distanceElement) distanceElement.textContent = `${distance.toFixed(2)} km`;
      
      // Calculate estimated travel time (assuming average speed of 30 km/h)
      const travelTimeHours = distance / 30;
      const travelTimeMinutes = Math.round(travelTimeHours * 60);
      const travelTimeElement = document.getElementById('travelTime');
      if (travelTimeElement) travelTimeElement.textContent = `${travelTimeMinutes} min`;
    } else {
      const distanceElement = document.getElementById('routeDistance');
      const travelTimeElement = document.getElementById('travelTime');
      if (distanceElement) distanceElement.textContent = '--';
      if (travelTimeElement) travelTimeElement.textContent = '--';
    }
    
    // Update destination status
    const destinationText = trackingData.coordinate_A?.name || 'Not set';
    const destinationElement = document.getElementById('destinationStatus');
    if (destinationElement) destinationElement.textContent = destinationText;
    
    // Update tracking status
    let statusText = 'Ready for QR scan';
    if (trackingData.delivery_status === 'driver_assigned') {
      statusText = 'Driver en route';
    } else if (trackingData.delivery_status === 'nobody_received') {
      statusText = 'Nobody received the item or courier';
    } else {
      statusText = 'Waiting for driver';
    }
    const statusElement = document.getElementById('trackingStatus');
    if (statusElement) statusElement.textContent = statusText;
    
    // Default speed display
    const speedElement = document.getElementById('currentSpeed');
    if (speedElement) speedElement.textContent = '10.0 km/h';
  }
  
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  async refreshTrackingData(qrCode) {
    if (!qrCode) return;
    
    this.showMessage('Refreshing tracking data...', 'info');
    
    try {
      const response = await fetch(`/api/qr-tracking/${qrCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        this.displayTrackingResults(data);
        this.showMessage('Tracking data refreshed!', 'success');
      } else {
        this.showMessage(data.message || 'Failed to refresh tracking data', 'error');
      }
    } catch (error) {
      console.error('Error refreshing tracking data:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  showMessage(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.getElementById('alert');
    const alertMessage = document.getElementById('alertMessage');
    
    if (!alertContainer || !alert || !alertMessage) return;
    
    // Set alert type
    alert.className = `alert alert-dismissible fade show alert-${type === 'error' ? 'danger' : type}`;
    alertMessage.textContent = message;
    
    // Show alert
    alertContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      alertContainer.style.display = 'none';
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  new UserDashboard();
});