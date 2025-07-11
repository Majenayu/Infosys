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
      // Check if QR code exists in the system
      const response = await fetch(`/api/qr-code/${qrCode}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('QR code found! Redirecting to tracking page...', 'success');
        
        // Store QR code in localStorage for tracking page
        localStorage.setItem('trackingQRCode', qrCode);
        localStorage.setItem('trackingData', JSON.stringify(data));
        
        // Add to tracking history
        this.addToTrackingHistory(qrCode, data);
        
        // Redirect to scan page with the QR code data
        setTimeout(() => {
          window.location.href = `/scan?qr=${qrCode}`;
        }, 1000);
        
      } else {
        this.showMessage(data.message || 'QR code not found in system', 'error');
      }
    } catch (error) {
      console.error('QR code lookup error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  addToTrackingHistory(qrCode, data) {
    try {
      let history = JSON.parse(localStorage.getItem('trackingHistory') || '[]');
      
      const newEntry = {
        qrCode: qrCode,
        locationName: data.location_name || 'Unknown Location',
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