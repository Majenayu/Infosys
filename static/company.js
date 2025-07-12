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
        this.showMessage(`Company registered successfully! Welcome, ${result.name}! Your Company ID is: ${result.company_id}`, 'success');
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
    // Map initialization removed - no longer needed for company registration
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize company authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CompanyAuth();
});