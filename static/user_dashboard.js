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
        this.showMessage('QR code found! Loading tracking information...', 'success');
        
        // Store QR code in localStorage for tracking history
        localStorage.setItem('trackingQRCode', qrCode);
        
        // Add to tracking history
        this.addToTrackingHistory(qrCode, data);
        
        // Display tracking results
        this.displayTrackingResults(data);
        
      } else {
        this.showMessage(data.message || 'QR code not found in system', 'error');
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
    
    // Initialize map
    this.initializeTrackingMap(trackingData);
  }

  async initializeTrackingMap(trackingData) {
    try {
      // Get HERE Maps API keys
      const keysResponse = await fetch('/api/here-keys');
      const keysData = await keysResponse.json();
      const apiKey = keysData.keys[0]; // Use primary API key
      
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