// Company Registration and Login JavaScript
class CompanyAuth {
  constructor() {
    this.map = null;
    this.platform = null;
    this.ui = null;
    this.mapGroup = null;
    this.HERE_API_KEYS = [
      "VivkTzkLRp8BPWqRgV12KUmuOHfy6mobXyHUJSEfOcA",
      "qOmqLOozpFXbHY1DD-N5xkTeAP8TYORuuEAbBO6NaGI",
      "fdEwg_luXCC7NWAtXFnTWWZCuoMDHZDhCdnVM0cXZQE",
      "KrksWbCEU3g3OnuQN3wDOncIgVTA2UrwIpTIN8iKzPQ",
      "YaQ_t8pg3O-_db-werIC_Prpikr0qz7Zc2zWHvKYadI"
    ];
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeMap();
  }

  setupEventListeners() {
    // Registration form
    const companyForm = document.getElementById('companyForm');
    if (companyForm) {
      companyForm.addEventListener('submit', (e) => this.handleRegistration(e));
    }

    // Login form
    const loginForm = document.getElementById('companyLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
  }

  async handleRegistration(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
      name: formData.get('name'),
      contactPerson: formData.get('contactPerson'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      password: formData.get('password'),
      apiUrl: formData.get('apiUrl'),
      apiKey: formData.get('apiKey'),
      address: formData.get('address')
    };

    try {
      const response = await fetch('/company/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage('Company registered successfully!', 'success');
        setTimeout(() => {
          window.location.href = '/company/login';
        }, 2000);
      } else {
        this.showMessage(result.message || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      const response = await fetch('/company/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        this.showMessage('Login successful!', 'success');
        // Store company data in localStorage
        localStorage.setItem('companyData', JSON.stringify(result.company));
        setTimeout(() => {
          window.location.href = '/company/dashboard';
        }, 1000);
      } else {
        this.showMessage(result.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  showMessage(message, type) {
    const statusAlert = document.getElementById('statusAlert');
    const statusMessage = document.getElementById('statusMessage');
    
    if (statusAlert && statusMessage) {
      statusMessage.textContent = message;
      statusAlert.className = `alert alert-dismissible fade show alert-${type === 'success' ? 'success' : 'danger'}`;
      statusAlert.style.display = 'block';
      
      setTimeout(() => {
        statusAlert.style.display = 'none';
      }, 5000);
    }
  }

  async initializeMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    try {
      // Try to initialize HERE Maps with API key priority
      let mapInitialized = false;
      
      for (let i = 0; i < this.HERE_API_KEYS.length && !mapInitialized; i++) {
        try {
          await this.sleep(i * 1000); // Progressive delay
          
          this.platform = new H.service.Platform({
            'apikey': this.HERE_API_KEYS[i]
          });
          
          const defaultMapTypes = this.platform.createDefaultMapTypes();
          
          this.map = new H.Map(
            mapContainer,
            defaultMapTypes.vector.normal.map,
            {
              zoom: 10,
              center: { lat: 12.9716, lng: 77.5946 } // Bangalore coordinates
            }
          );
          
          const behavior = new H.mapevents.Behavior();
          this.ui = new H.ui.UI.createDefault(this.map);
          this.mapGroup = new H.map.Group();
          this.map.getViewPort().addResizeListener();
          
          mapInitialized = true;
          console.log('Company registration map initialized successfully');
          break;
          
        } catch (error) {
          console.log(`Map initialization failed with key ${i + 1}:`, error);
          continue;
        }
      }
      
      if (!mapInitialized) {
        throw new Error('All HERE Maps API keys failed');
      }
      
    } catch (error) {
      console.error('Map initialization failed:', error);
      mapContainer.innerHTML = '<div class="text-center p-4"><p class="text-muted">Map unavailable</p></div>';
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize company authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CompanyAuth();
});