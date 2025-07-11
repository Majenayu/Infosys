// HERE Map initialization for company registration page
let platform, map, geocoder;

// Multiple API keys for better reliability
const HERE_API_KEYS = [
  "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI",
  "fdEwg_luXCC7NWAtXFnTWWZCuoMDHZDhCdnVM0cXZQE", 
  "KrksWbCEU3g3OnuQN3wDOncIgVTA2UrwIpTIN8iKzPQ",
  "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI"
];

let currentApiKeyIndex = 0;

// Initialize HERE Maps with fallback API keys
const initializeMap = async () => {
  let platform = null;
  
  // Try each API key until one works
  for (let i = 0; i < HERE_API_KEYS.length; i++) {
    try {
      const API_KEY = HERE_API_KEYS[currentApiKeyIndex];
      console.log(`Trying HERE Maps API key ${currentApiKeyIndex + 1}/${HERE_API_KEYS.length}`);
      
      platform = new H.service.Platform({
        apikey: API_KEY
      });

      const defaultLayers = platform.createDefaultLayers();
      const mapContainer = document.getElementById('mapContainer');
      
      if (!mapContainer) {
        console.warn('Map container not found');
        return;
      }

      map = new H.Map(
        mapContainer,
        defaultLayers.vector.normal.map,
        {
          zoom: 5,
          center: { lat: 20.5937, lng: 78.9629 } // Center on India
        }
      );

      // Enable map interaction
      const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
      const ui = H.ui.UI.createDefault(map, defaultLayers);
      
      // Initialize geocoder
      geocoder = platform.getSearchService();

      // Resize map when window resizes
      window.addEventListener('resize', () => {
        if (map) {
          map.getViewPort().resize();
        }
      });

      console.log(`Map initialized successfully with API key ${currentApiKeyIndex + 1}`);
      return; // Success, exit the loop
      
    } catch (error) {
      console.error(`Failed to initialize map with API key ${currentApiKeyIndex + 1}:`, error);
      currentApiKeyIndex = (currentApiKeyIndex + 1) % HERE_API_KEYS.length;
      
      // If we've tried all keys, show error
      if (currentApiKeyIndex === 0) {
        console.error('All HERE Maps API keys failed');
        showStatus('Map initialization failed - all API keys exhausted', 'error');
        return;
      }
    }
  }
};

// Handle form submission
const handleFormSubmission = () => {
  const form = document.getElementById('companyForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = '🔄 Registering...';

    const formData = {
      name: this.name.value.trim(),
      contactPerson: this.contactPerson.value.trim(),
      email: this.email.value.trim(),
      phone: this.phone.value.trim(),
      apiUrl: this.apiUrl.value.trim(),
      apiKey: this.apiKey.value.trim(),
      address: this.address.value.trim()
    };

    // Validate form data
    if (!validateFormData(formData)) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      return;
    }

    try {
      const response = await fetch('/register-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (response.ok) {
        showStatus(data.message || 'Registration completed successfully!', 'success');
        this.reset();
        
        // Try to geocode the address and show on map
        if (geocoder && formData.address) {
          geocodeAddress(formData.address);
        }
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showStatus(error.message || 'Error submitting registration. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
};

// Validate form data
const validateFormData = (data) => {
  const requiredFields = ['name', 'contactPerson', 'email', 'phone', 'apiUrl', 'apiKey', 'address'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      showStatus(`Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`, 'error');
      return false;
    }
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    showStatus('Please enter a valid email address', 'error');
    return false;
  }
  
  // Validate URL format
  try {
    new URL(data.apiUrl);
  } catch {
    showStatus('Please enter a valid API URL', 'error');
    return false;
  }
  
  return true;
};

// Geocode address and show on map
const geocodeAddress = (address) => {
  if (!geocoder || !map) return;
  
  const params = {
    q: address,
    limit: 1
  };

  geocoder.geocode(params, (result) => {
    if (result.items && result.items.length > 0) {
      const location = result.items[0];
      const coords = location.position;
      
      // Center map on the location
      map.setCenter(coords);
      map.setZoom(12);
      
      // Add marker
      const iconMarkup = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#dc3545" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
      `;
      
      const icon = new H.map.Icon('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconMarkup));
      const marker = new H.map.Marker(coords, { icon });
      
      // Clear existing markers and add new one
      map.removeObjects(map.getObjects());
      map.addObject(marker);
      
      showStatus('Address located on map', 'success');
    } else {
      console.warn('Address not found:', address);
    }
  }, (error) => {
    console.error('Geocoding error:', error);
  });
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

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('TrackSmart Company Registration initialized');
  initializeMap();
  handleFormSubmission();
});

// Initialize map when window loads (backup)
window.addEventListener('load', () => {
  if (!map) {
    initializeMap();
  }
});
