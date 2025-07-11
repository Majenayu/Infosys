// HERE Maps and QR Code generator functionality
let platform, map, searchService, currentMarker, qrCode;

// HERE Maps API Key
const API_KEY = "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI";

// UI Elements
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
const locationName = document.getElementById('locationName');
const locationAddress = document.getElementById('locationAddress');
const locationCoords = document.getElementById('locationCoords');
const myLocationBtn = document.getElementById('myLocationBtn');
const downloadBtn = document.getElementById('downloadBtn');
const qrcodeElement = document.getElementById('qrcode');
const statusElement = document.getElementById('status');

// Current location data
let currentLocationData = null;

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
        zoom: 7,
        center: { lat: 15.3173, lng: 75.7139 } // Karnataka center
      }
    );

    // Enable map interaction
    const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
    const ui = H.ui.UI.createDefault(map, defaultLayers);
    
    // Initialize search service
    searchService = platform.getSearchService();

    // Handle map clicks
    map.addEventListener('tap', (evt) => {
      const coord = map.screenToGeo(
        evt.currentPointer.viewportX,
        evt.currentPointer.viewportY
      );
      
      reverseGeocode(coord.lat, coord.lng);
    });

    // Resize map when window resizes
    window.addEventListener('resize', () => {
      if (map) {
        map.getViewPort().resize();
      }
    });

    console.log('Map initialized successfully');
    showStatus('Map loaded. Click on the map or search for a location.', 'info');
  } catch (error) {
    console.error('Failed to initialize map:', error);
    showStatus('Map initialization failed. Please reload the page.', 'error');
  }
};

// Search functionality
const initializeSearch = () => {
  if (!searchInput) return;

  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 3) {
      hideSuggestions();
      return;
    }
    
    searchTimeout = setTimeout(() => {
      searchLocation(query);
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSuggestions();
    }
  });
};

// Search for locations
const searchLocation = (query) => {
  if (!searchService) return;

  const searchParams = {
    q: query + ', Karnataka, India',
    limit: 5,
    at: '15.3173,75.7139'
  };

  searchService.geocode(searchParams, (result) => {
    if (result.items && result.items.length > 0) {
      displaySuggestions(result.items);
    } else {
      hideSuggestions();
    }
  }, (error) => {
    console.error('Search error:', error);
    hideSuggestions();
  });
};

// Display search suggestions
const displaySuggestions = (items) => {
  if (!searchSuggestions) return;

  searchSuggestions.innerHTML = '';
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'search-suggestion';
    div.innerHTML = `
      <strong>${item.title}</strong>
      <br><small class="text-muted">${item.address.label}</small>
    `;
    
    div.addEventListener('click', () => {
      selectSuggestion(item);
    });
    
    searchSuggestions.appendChild(div);
  });
  
  searchSuggestions.style.display = 'block';
};

// Select a search suggestion
const selectSuggestion = (item) => {
  const coords = item.position;
  
  // Update search input
  if (searchInput) {
    searchInput.value = item.title;
  }
  
  // Hide suggestions
  hideSuggestions();
  
  // Update marker and map
  updateMarker(coords, item.title, item.address.label);
  updateLocationInfo(item.title, item.address.label, coords);
  
  // Generate QR code
  generateQR(item.title, item.address.label, coords);
};

// Hide search suggestions
const hideSuggestions = () => {
  if (searchSuggestions) {
    searchSuggestions.style.display = 'none';
  }
};

// Update map marker
const updateMarker = (coords, name, address) => {
  if (!map) return;

  // Remove existing marker
  if (currentMarker) {
    map.removeObject(currentMarker);
  }

  // Create custom marker icon
  const iconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#dc3545" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
    </svg>
  `;
  
  const icon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkup));
  currentMarker = new H.map.Marker(coords, { icon });
  
  map.addObject(currentMarker);
  map.setCenter(coords);
  map.setZoom(15);
};

// Update location information display
const updateLocationInfo = (name, address, coords) => {
  if (locationName) locationName.textContent = name;
  if (locationAddress) locationAddress.textContent = address;
  if (locationCoords) locationCoords.textContent = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  
  // Store current location data
  currentLocationData = {
    name,
    address,
    latitude: coords.lat,
    longitude: coords.lng,
    googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
    hereMapsUrl: `https://wego.here.com/directions/mix/${coords.lat},${coords.lng}`,
    timestamp: new Date().toISOString()
  };
};

// Generate QR code
const generateQR = (name, address, coords) => {
  if (!qrcodeElement) return;

  // Clear existing QR code
  qrcodeElement.innerHTML = '';

  const qrData = {
    name,
    address,
    latitude: coords.lat,
    longitude: coords.lng,
    googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
    hereMapsUrl: `https://wego.here.com/directions/mix/${coords.lat},${coords.lng}`,
    timestamp: new Date().toISOString()
  };

  try {
    qrCode = new QRCode(qrcodeElement, {
      text: JSON.stringify(qrData),
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    // Enable download button
    if (downloadBtn) {
      downloadBtn.disabled = false;
    }

    // Store location data
    storeLocationData(qrData);
    
    showStatus('QR code generated successfully!', 'success');
  } catch (error) {
    console.error('QR generation error:', error);
    showStatus('Failed to generate QR code', 'error');
  }
};

// Store location data in database
const storeLocationData = async (data) => {
  try {
    const response = await fetch('/store-location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to store location data');
    }

    console.log('Location data stored successfully');
  } catch (error) {
    console.error('Error storing location data:', error);
  }
};

// Reverse geocode coordinates
const reverseGeocode = (lat, lng) => {
  if (!searchService) return;

  const reverseParams = {
    at: `${lat},${lng}`,
    limit: 1
  };

  searchService.reverseGeocode(reverseParams, (result) => {
    if (result.items && result.items.length > 0) {
      const item = result.items[0];
      const coords = { lat, lng };
      
      updateMarker(coords, item.title || 'Selected Location', item.address.label);
      updateLocationInfo(item.title || 'Selected Location', item.address.label, coords);
      generateQR(item.title || 'Selected Location', item.address.label, coords);
    }
  }, (error) => {
    console.error('Reverse geocoding error:', error);
    showStatus('Failed to get location details', 'error');
  });
};

// Get user's current location
const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by this browser', 'error');
    return;
  }

  if (myLocationBtn) {
    myLocationBtn.textContent = '🔄 Getting location...';
    myLocationBtn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      reverseGeocode(coords.lat, coords.lng);
      
      if (myLocationBtn) {
        myLocationBtn.textContent = '📍 Get My Current Location';
        myLocationBtn.disabled = false;
      }
      
      showStatus('Current location found!', 'success');
    },
    (error) => {
      console.error('Geolocation error:', error);
      showStatus('Failed to get current location', 'error');
      
      if (myLocationBtn) {
        myLocationBtn.textContent = '📍 Get My Current Location';
        myLocationBtn.disabled = false;
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
};

// Download QR code
const downloadQRCode = () => {
  if (!qrCode || !currentLocationData) {
    showStatus('No QR code to download', 'error');
    return;
  }

  try {
    const canvas = qrcodeElement.querySelector('canvas');
    if (!canvas) {
      showStatus('QR code canvas not found', 'error');
      return;
    }

    // Create download link
    const link = document.createElement('a');
    link.download = `qr-${currentLocationData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    link.href = canvas.toDataURL();
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('QR code downloaded!', 'success');
  } catch (error) {
    console.error('Download error:', error);
    showStatus('Failed to download QR code', 'error');
  }
};

// Show status messages
const showStatus = (message, type) => {
  if (!statusElement) return;
  
  statusElement.className = `status ${type}`;
  statusElement.textContent = message;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = 'status';
  }, 5000);
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('QR Location Generator initialized');
  
  initializeMap();
  initializeSearch();
  
  // Event listeners
  if (myLocationBtn) {
    myLocationBtn.addEventListener('click', getCurrentLocation);
  }
  
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadQRCode);
  }
  
  console.log('QR Generator initialization complete');
});

// Initialize map when window loads (backup)
window.addEventListener('load', () => {
  if (!map) {
    initializeMap();
  }
});