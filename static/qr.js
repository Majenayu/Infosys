// HERE Maps API Configuration with multiple API keys for better reliability - prioritized order
const HERE_API_KEYS = [
  "VivkTzkLRp8BPWqRgV12KUmuOHfy6mobXyHUJSEfOcA",
  "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI",
  "fdEwg_luXCC7NWAtXFnTWWZCuoMDHZDhCdnVM0cXZQE", 
  "KrksWbCEU3g3OnuQN3wDOncIgVTA2UrwIpTIN8iKzPQ",
  "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI"
];

let currentApiKeyIndex = 0;
let platform, defaultLayers, map, mapEvents, behavior, ui, geocoder;
let currentMarker = null;
let currentQR = null;
let currentLocation = null;
let searchTimeout = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');
const myLocationBtn = document.getElementById('myLocationBtn');
const downloadBtn = document.getElementById('downloadBtn');
const qrContainer = document.getElementById('qrcode');

// Initialize HERE Maps with rate limiting handling
const initializeMap = async () => {
  try {
    // Use the first API key with rate limiting delay
    const API_KEY = HERE_API_KEYS[0]; // Use prioritized API key
    console.log(`Initializing QR Map with prioritized API key`);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    platform = new H.service.Platform({ 
      apikey: API_KEY,
      // Add rate limiting configuration
      'rest-api': {
        'search': {
          'host': 'geocode.search.hereapi.com'
        }
      }
    });
    
    // Initialize layers with error handling
    try {
      defaultLayers = platform.createDefaultLayers();
    } catch (layerError) {
      console.warn('Vector layers failed, trying raster layers:', layerError);
      // Fallback to raster layers if vector fails
      defaultLayers = {
        raster: {
          normal: {
            map: platform.createDefaultLayers().raster.normal.map
          }
        }
      };
    }
    
    geocoder = platform.getSearchService();

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
      zoom: 7,
      center: { lat: 15.3173, lng: 75.7139 }
    });

    // Enable map events and behaviors
    mapEvents = new H.mapevents.MapEvents(map);
    behavior = new H.mapevents.Behavior(mapEvents);
    ui = H.ui.UI.createDefault(map);

    // Add map click listener
    map.addEventListener('tap', handleMapClick);

    // Resize map when window resizes
    window.addEventListener('resize', () => {
      if (map) {
        map.getViewPort().resize();
      }
    });

    console.log('QR Map initialized successfully');
    showStatus('QR Generator ready. Click map or search to begin.', 'success');
    
  } catch (error) {
    console.error('Failed to initialize QR map:', error);
    showStatus('Map temporarily unavailable - you can still use search functionality', 'warning');
    
    // Initialize without map for search functionality
    try {
      const API_KEY = HERE_API_KEYS[0];
      platform = new H.service.Platform({ apikey: API_KEY });
      geocoder = platform.getSearchService();
      console.log('Search functionality initialized without map');
    } catch (searchError) {
      console.error('Search initialization also failed:', searchError);
      showStatus('Map and search temporarily unavailable - please try again later', 'error');
    }
  }
};

// Handle map click events
const handleMapClick = (evt) => {
  try {
    const pointer = evt.currentPointer;
    const coord = map.screenToGeo(pointer.viewportX, pointer.viewportY);

    // Reverse geocode the clicked location
    geocoder.reverseGeocode({ at: `${coord.lat},${coord.lng}` }, (result) => {
      const location = result.items?.[0];
      const name = location?.title || 'Selected Location';
      const address = location?.address?.label || `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`;
      
      updateLocation(coord, name, address);
      showStatus('Location selected from map', 'success');
    }, (error) => {
      console.error('Reverse geocoding error:', error);
      const name = 'Selected Location';
      const address = `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`;
      updateLocation(coord, name, address);
      showStatus('Location selected (address lookup failed)', 'success');
    });
  } catch (error) {
    console.error('Map click error:', error);
    showStatus('Error selecting location', 'error');
  }
};

// Search functionality
const setupSearch = () => {
  if (!searchInput) return;

  // Handle input changes
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (searchTimeout) clearTimeout(searchTimeout);

    if (query.length < 2) {
      hideSuggestions();
      return;
    }

    searchTimeout = setTimeout(() => {
      getSuggestions(query);
    }, 300);
  });

  // Handle Enter key
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        searchLocation(query);
        hideSuggestions();
      }
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSuggestions();
    }
  });
};

// Get search suggestions
const getSuggestions = (query) => {
  if (!geocoder) return;

  const params = {
    q: query,
    at: '15.3173,75.7139',
    countryCode: 'IND',
    limit: 5
  };

  geocoder.autosuggest(params, (result) => {
    if (result && result.items) {
      displaySuggestions(result.items);
    } else {
      hideSuggestions();
    }
  }, (error) => {
    console.error('Suggestion error:', error);
    hideSuggestions();
  });
};

// Display search suggestions
const displaySuggestions = (items) => {
  if (!searchSuggestions) return;

  searchSuggestions.innerHTML = '';
  
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = item.title + (item.vicinity ? ` - ${item.vicinity}` : '');
    div.onclick = () => selectSuggestion(item);
    searchSuggestions.appendChild(div);
  });
  
  searchSuggestions.style.display = 'block';
};

// Select a suggestion
const selectSuggestion = (item) => {
  if (searchInput) {
    searchInput.value = item.title;
  }
  hideSuggestions();

  if (item.position) {
    const coords = item.position;
    map.setCenter(coords);
    map.setZoom(15);
    const name = item.title;
    const address = item.vicinity || item.title;
    updateLocation(coords, name, address);
  }
};

// Hide suggestions dropdown
const hideSuggestions = () => {
  if (searchSuggestions) {
    searchSuggestions.style.display = 'none';
  }
};

// Search for a specific location
const searchLocation = (query) => {
  if (!geocoder) return;

  const params = {
    q: `${query} Karnataka`,
    at: '15.3173,75.7139',
    countryCode: 'IND',
    limit: 1
  };

  geocoder.geocode(params, (result) => {
    if (result.items && result.items.length > 0) {
      const location = result.items[0];
      const coords = location.position;
      const address = location.address?.label || location.vicinity || location.title;
      
      map.setCenter(coords);
      map.setZoom(15);
      updateLocation(coords, location.title, address);
    } else {
      showStatus('Location not found in Karnataka', 'error');
    }
  }, (error) => {
    console.error('Search error:', error);
    showStatus('Search failed', 'error');
  });
};

// Get current location
const setupCurrentLocation = () => {
  if (!myLocationBtn) return;

  myLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showStatus('Geolocation not supported by this browser', 'error');
      return;
    }

    const originalText = myLocationBtn.textContent;
    myLocationBtn.textContent = '🔄 Getting Location...';
    myLocationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition((position) => {
      const coords = { 
        lat: position.coords.latitude, 
        lng: position.coords.longitude 
      };
      
      map.setCenter(coords);
      map.setZoom(16);

      // Reverse geocode current location
      geocoder.reverseGeocode({ at: `${coords.lat},${coords.lng}` }, (result) => {
        const location = result.items?.[0];
        const name = 'My Current Location';
        const address = location?.address?.label || `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        
        updateLocation(coords, name, address);
        showStatus('Current location found!', 'success');
      }, (error) => {
        console.error('Reverse geocoding error:', error);
        const name = 'My Current Location';
        const address = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        updateLocation(coords, name, address);
        showStatus('Current location found!', 'success');
      });

      myLocationBtn.textContent = originalText;
      myLocationBtn.disabled = false;
    }, (error) => {
      let message = 'Unable to get current location';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Location access denied by user';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'Location information unavailable';
      } else if (error.code === error.TIMEOUT) {
        message = 'Location request timed out';
      }
      
      showStatus(message, 'error');
      myLocationBtn.textContent = originalText;
      myLocationBtn.disabled = false;
    });
  });
};

// Update location and generate QR
const updateLocation = (coords, name, address) => {
  // Update marker on map
  updateMarker(coords, name, address);
  
  // Update location info display
  updateLocationInfo(name, address, coords);
  
  // Generate QR code
  generateQR(name, address, coords);
};

// Update marker on map
const updateMarker = (coords, name, address) => {
  if (!map) return;

  // Remove existing marker
  if (currentMarker) {
    map.removeObject(currentMarker);
  }

  // Create new marker with custom icon
  const iconMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#dc3545" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
    </svg>
  `;
  
  const icon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkup));
  currentMarker = new H.map.Marker(coords, { icon });
  map.addObject(currentMarker);

  // Show info bubble temporarily
  if (ui) {
    const bubble = new H.ui.InfoBubble(coords, { content: address });
    ui.addBubble(bubble);
    setTimeout(() => ui.removeBubble(bubble), 3000);
  }
};

// Update location information display
const updateLocationInfo = (name, address, coords) => {
  const nameElement = document.getElementById('locationName');
  const addressElement = document.getElementById('locationAddress');
  const coordsElement = document.getElementById('locationCoords');

  if (nameElement) nameElement.textContent = name;
  if (addressElement) addressElement.textContent = address;
  if (coordsElement) coordsElement.textContent = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

  currentLocation = { name, address, coords };
};

// Generate QR code
const generateQR = (name, address, coords) => {
  if (!qrContainer) return;

  // Clear existing QR code
  qrContainer.innerHTML = '';

  const data = {
    name,
    address,
    latitude: coords.lat,
    longitude: coords.lng,
    googleMapsUrl: `https://www.google.com/maps?q=${coords.lat},${coords.lng}`,
    hereMapsUrl: `https://wego.here.com/directions/mix/${coords.lat},${coords.lng}`,
    timestamp: new Date().toISOString(),
    qr_id: null // Will be set after server response
  };

  try {
    currentQR = new QRCode(qrContainer, {
      text: JSON.stringify(data),
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });

    if (downloadBtn) {
      downloadBtn.disabled = false;
    }

    // Store location data
    storeLocationData(data);
    showStatus('QR code generated successfully!', 'success');
  } catch (error) {
    console.error('QR generation error:', error);
    showStatus('Failed to generate QR code', 'error');
  }
};

// Store location data to server
const storeLocationData = async (data) => {
  try {
    const response = await fetch('/store-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Location data stored successfully');
      
      // Display QR ID if available
      if (result.qr_id) {
        showStatus(`QR code generated! ID: ${result.qr_id}`, 'success');
        
        // Update the QR code display with the ID
        const qrIdElement = document.getElementById('qrId');
        if (qrIdElement) {
          qrIdElement.textContent = result.qr_id;
        }
        
        // Add QR ID to the download filename
        if (currentLocation && downloadBtn) {
          const originalName = currentLocation.name || 'Location';
          currentLocation.qr_id = result.qr_id;
          downloadBtn.setAttribute('data-qr-id', result.qr_id);
        }
        
        // Regenerate QR code with the QR ID included
        const updatedData = {
          ...data,
          qr_id: result.qr_id
        };
        
        // Clear and regenerate QR code with updated data
        qrContainer.innerHTML = '';
        currentQR = new QRCode(qrContainer, {
          text: JSON.stringify(updatedData),
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    } else {
      const error = await response.json();
      console.warn('Failed to store location data:', error.message);
      showStatus(`Failed to store location: ${error.message}`, 'error');
    }
  } catch (error) {
    console.warn('Offline or server unavailable:', error);
    showStatus('Offline or server unavailable', 'warning');
  }
};

// Setup QR download functionality
const setupDownload = () => {
  if (!downloadBtn) return;

  downloadBtn.addEventListener('click', () => {
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) {
      showStatus('No QR code to download', 'error');
      return;
    }

    try {
      const link = document.createElement('a');
      const qrId = currentLocation.qr_id || downloadBtn.getAttribute('data-qr-id') || 'XXXX';
      const locationName = currentLocation.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `QR_${qrId}_${locationName}_${Date.now()}.png`;
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showStatus(`QR code downloaded! ID: ${qrId}`, 'success');
    } catch (error) {
      console.error('Download error:', error);
      showStatus('Failed to download QR code', 'error');
    }
  });
};

// Show status messages
const showStatus = (message, type) => {
  const statusElement = document.getElementById('status');
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  statusElement.style.display = 'block';

  // Auto-hide after 4 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 4000);
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('QR Generator initializing...');
  
  // Initialize components
  initializeMap();
  setupSearch();
  setupCurrentLocation();
  setupDownload();
  
  console.log('QR Generator initialized successfully');
});

// Backup initialization on window load
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
