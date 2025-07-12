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
        } else if (data.message === 'boarded_and_arriving') {
          this.showMessage('Item is boarded and arriving!', 'success');
          this.showBoardedAndArrivingMessage(data);
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

  showBoardedAndArrivingMessage(data) {
    const trackingResults = document.getElementById('trackingResults');
    if (trackingResults) {
      trackingResults.style.display = 'block';
      trackingResults.innerHTML = `
        <div class="alert alert-success text-center" style="padding: 2rem;">
          <h2 class="display-4 mb-4">🚀 BOARDED AND ARRIVING</h2>
          <h4 class="mb-3">Your item is on its way!</h4>
          <p class="lead">QR Code: <strong>${data.qr_id}</strong></p>
          <p class="lead">Delivery Partner: <strong>${data.delivery_partner_name}</strong></p>
          <hr class="my-4">
          <p class="mb-0">Your package has been boarded and is currently en route to the destination.</p>
          <p class="text-muted">You will receive updates as it progresses.</p>
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
    document.getElementById('destinationName').textContent = trackingData.coordinate_A?.name || 'Unknown Location';
    document.getElementById('destinationAddress').textContent = trackingData.coordinate_A?.address || 'Address not available';
    
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
      const apiKeys = keysData.keys;
      
      // Try multiple API keys with rate limiting protection
      let platform, defaultLayers;
      let apiKeyIndex = 0;
      let success = false;
      
      while (!success && apiKeyIndex < apiKeys.length) {
        try {
          // Progressive delay to prevent rate limiting
          const delay = apiKeyIndex === 0 ? 1000 : 3000 + (apiKeyIndex * 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          console.log(`Trying HERE Maps API key ${apiKeyIndex + 1}/${apiKeys.length} (delay: ${delay}ms)`);
          
          platform = new H.service.Platform({
            'apikey': apiKeys[apiKeyIndex],
            'useHTTPS': true
          });
          
          // Test platform first
          await new Promise(resolve => setTimeout(resolve, 200));
          defaultLayers = platform.createDefaultLayers();
          
          // Test layer creation
          if (!defaultLayers || (!defaultLayers.vector && !defaultLayers.raster)) {
            throw new Error('Invalid layers created');
          }
          
          success = true;
          console.log(`HERE Maps initialized successfully with API key ${apiKeyIndex + 1}`);
          
        } catch (error) {
          console.warn(`API key ${apiKeyIndex + 1} failed:`, error.message);
          apiKeyIndex++;
          
          // If it's a rate limit error, add extra delay
          if (error.message && error.message.includes('429')) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
      
      if (!success) {
        console.error('All HERE Maps API keys failed, using fallback map');
        this.initializeFallbackMap(trackingData);
        return;
      }
      
      // Initialize the map
      const mapContainer = document.getElementById('trackingMap');
      if (!mapContainer) {
        console.error('Map container not found');
        return;
      }
      
      // Get coordinates from tracking data with safety checks
      const destLat = trackingData.coordinate_A?.latitude;
      const destLng = trackingData.coordinate_A?.longitude;
      const deliveryLat = trackingData.coordinate_B?.latitude;
      const deliveryLng = trackingData.coordinate_B?.longitude;
      
      if (!destLat || !destLng || !deliveryLat || !deliveryLng) {
        console.error('Missing coordinate data:', trackingData);
        return;
      }
      
      // Create the map centered between both coordinates
      const centerLat = (destLat + deliveryLat) / 2;
      const centerLng = (destLng + deliveryLng) / 2;
      
      // Use terrain/satellite map for Google Maps-like appearance with comprehensive fallback
      let mapLayer;
      try {
        // Priority order: terrain > satellite > normal raster > vector
        if (defaultLayers.raster && defaultLayers.raster.terrain && defaultLayers.raster.terrain.map) {
          mapLayer = defaultLayers.raster.terrain.map;
          console.log('Using terrain map layer for Google Maps style');
        } else if (defaultLayers.raster && defaultLayers.raster.satellite && defaultLayers.raster.satellite.map) {
          mapLayer = defaultLayers.raster.satellite.map;
          console.log('Using satellite map layer for Google Maps style');
        } else if (defaultLayers.raster && defaultLayers.raster.normal && defaultLayers.raster.normal.map) {
          mapLayer = defaultLayers.raster.normal.map;
          console.log('Using normal raster map layer');
        } else {
          mapLayer = defaultLayers.vector.normal.map;
          console.log('Using vector map layer as final fallback');
        }
      } catch (e) {
        console.warn('Error selecting map layer, using fallback:', e);
        this.initializeFallbackMap(trackingData);
        return;
      }
      
      const map = new H.Map(
        mapContainer,
        mapLayer,
        {
          zoom: 11,
          center: { lat: centerLat, lng: centerLng },
          pixelRatio: window.devicePixelRatio || 1
        }
      );
      
      // Add map behavior and UI
      const behavior = new H.mapevents.Behavior();
      const ui = new H.ui.UI(map);
      
      // Create custom destination marker (Google Maps style red pin)
      const destIcon = new H.map.Icon(
        'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0C7.2 0 0 7.2 0 16s16 24 16 24 16-15.2 16-24S24.8 0 16 0z" fill="#EA4335"/>
            <circle cx="16" cy="16" r="8" fill="white"/>
            <circle cx="16" cy="16" r="4" fill="#EA4335"/>
          </svg>
        `),
        { size: { w: 32, h: 40 }, anchor: { x: 16, y: 40 } }
      );
      
      const destMarker = new H.map.Marker({ lat: destLat, lng: destLng }, { icon: destIcon });
      
      // Create custom delivery partner marker (Google Maps style blue truck)
      const deliveryIcon = new H.map.Icon(
        'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0C7.2 0 0 7.2 0 16s16 24 16 24 16-15.2 16-24S24.8 0 16 0z" fill="#4285F4"/>
            <circle cx="16" cy="16" r="8" fill="white"/>
            <text x="16" y="20" text-anchor="middle" font-family="Arial" font-size="12" fill="#4285F4">🚚</text>
          </svg>
        `),
        { size: { w: 32, h: 40 }, anchor: { x: 16, y: 40 } }
      );
      
      const deliveryMarker = new H.map.Marker({ lat: deliveryLat, lng: deliveryLng }, { icon: deliveryIcon });
      
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
          
          // Create Google Maps-style blue route line
          const linestring = H.geo.LineString.fromFlexiblePolyline(routeShape);
          const polyline = new H.map.Polyline(linestring, {
            style: { 
              strokeColor: '#4285F4', 
              lineWidth: 8,
              lineCap: 'round',
              lineJoin: 'round'
            }
          });
          
          // Add route to map
          map.addObject(polyline);
          console.log('Google Maps-style route added successfully');
        }
      }, (error) => {
        console.warn('Route calculation failed, showing Google Maps-style direct path:', error);
        
        // Create Google Maps-style direct path line
        const linestring = new H.geo.LineString();
        linestring.pushPoint({ lat: deliveryLat, lng: deliveryLng });
        linestring.pushPoint({ lat: destLat, lng: destLng });
        
        const polyline = new H.map.Polyline(linestring, {
          style: { 
            strokeColor: '#4285F4', 
            lineWidth: 8,
            lineCap: 'round',
            lineJoin: 'round',
            lineDash: [10, 5] // Dashed line for direct path
          }
        });
        
        map.addObject(polyline);
        console.log('Google Maps-style direct path added');
      });
      
      // Fit the map to show both markers with padding (Google Maps style)
      const group = new H.map.Group();
      group.addObject(destMarker);
      group.addObject(deliveryMarker);
      map.getViewPort().resize();
      map.getViewPort().setViewBounds(group.getBoundingBox(), false);
      
      // Add some padding for better visibility
      setTimeout(() => {
        const currentZoom = map.getZoom();
        map.setZoom(Math.max(currentZoom - 1, 8)); // Zoom out slightly for better overview
      }, 100);
      
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
      console.log('Falling back to simple map display');
      this.initializeFallbackMap(trackingData);
    }
  }

  initializeFallbackMap(trackingData) {
    try {
      const mapContainer = document.getElementById('trackingMap');
      if (!mapContainer) return;
      
      // Clear any existing content
      mapContainer.innerHTML = '';
      
      // Create fallback map with basic styling
      mapContainer.style.cssText = `
        width: 100%;
        height: 400px;
        background: linear-gradient(45deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 8px;
        position: relative;
        font-family: Arial, sans-serif;
      `;
      
      // Add destination and driver markers
      const destLat = trackingData.coordinate_A?.latitude;
      const destLng = trackingData.coordinate_A?.longitude;
      const deliveryLat = trackingData.coordinate_B?.latitude;
      const deliveryLng = trackingData.coordinate_B?.longitude;
      
      if (destLat && destLng && deliveryLat && deliveryLng) {
        // Calculate distance
        const distance = this.calculateDistance(
          {lat: destLat, lng: destLng},
          {lat: deliveryLat, lng: deliveryLng}
        );
        
        // Create visual representation
        mapContainer.innerHTML = `
          <div style="position: absolute; top: 20px; left: 20px; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <div style="color: #d32f2f; font-weight: bold; margin-bottom: 5px;">📍 Destination</div>
            <div style="font-size: 12px;">${trackingData.coordinate_A?.name || 'Unknown Location'}</div>
            <div style="font-size: 10px; color: #666;">${destLat.toFixed(4)}, ${destLng.toFixed(4)}</div>
          </div>
          
          <div style="position: absolute; top: 20px; right: 20px; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <div style="color: #1976d2; font-weight: bold; margin-bottom: 5px;">🚚 Driver</div>
            <div style="font-size: 12px;">${trackingData.coordinate_B?.delivery_partner_name || 'Unknown Partner'}</div>
            <div style="font-size: 10px; color: #666;">${deliveryLat.toFixed(4)}, ${deliveryLng.toFixed(4)}</div>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); text-align: center; max-width: 300px;">
            <div style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px;">🗺️ Route Information</div>
            <div style="margin-bottom: 8px;">
              <span style="color: #666;">Distance: </span>
              <span style="font-weight: bold; color: #1976d2;">${distance.toFixed(2)} km</span>
            </div>
            <div style="margin-bottom: 15px;">
              <span style="color: #666;">Status: </span>
              <span style="font-weight: bold; color: #4caf50;">Driver en route</span>
            </div>
            <button onclick="window.open('https://www.google.com/maps/dir/${deliveryLat},${deliveryLng}/${destLat},${destLng}', '_blank')" 
                    style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">
              🗺️ Open in Google Maps
            </button>
          </div>
          
          <div style="position: absolute; bottom: 10px; right: 10px; font-size: 10px; color: #666; background: rgba(255,255,255,0.8); padding: 5px; border-radius: 3px;">
            Fallback Map Mode
          </div>
        `;
      } else {
        mapContainer.innerHTML = `
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); text-align: center;">
            <div style="font-size: 18px; color: #f44336; margin-bottom: 10px;">⚠️ Map Unavailable</div>
            <div style="color: #666; margin-bottom: 15px;">Unable to load map data</div>
            <button onclick="location.reload()" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
              🔄 Refresh Page
            </button>
          </div>
        `;
      }
      
      this.showMessage('Map service temporarily unavailable. Using fallback display.', 'warning');
      
    } catch (fallbackError) {
      console.error('Fallback map initialization failed:', fallbackError);
      const mapContainer = document.getElementById('trackingMap');
      if (mapContainer) {
        mapContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Map unavailable</div>';
      }
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