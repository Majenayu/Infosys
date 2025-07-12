// User Authentication JavaScript

class UserAuth {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkElements();
  }

  checkElements() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (!loginForm || !registerForm) {
      console.error('Required form elements not found');
      return false;
    }
    
    console.log('User authentication initialized');
    return true;
  }

  bindEvents() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }
    
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
      this.showMessage('Please fill in all fields', 'error');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showMessage('Please enter a valid email address', 'error');
      return;
    }

    try {
      const response = await fetch('/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Login successful! Redirecting...', 'success');
        
        // Store user data in localStorage
        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('userLoggedIn', 'true');
        
        // Redirect to user dashboard
        setTimeout(() => {
          window.location.href = '/user/dashboard';
        }, 1000);
      } else {
        this.showMessage(data.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    this.clearMessages();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();
    const password = document.getElementById('password').value;
    
    // Validation
    if (!name || !email || !phone || !address || !password) {
      this.showMessage('Please fill in all fields', 'error');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showMessage('Please enter a valid email address', 'error');
      return;
    }

    if (!this.isValidPhone(phone)) {
      this.showMessage('Please enter a valid phone number', 'error');
      return;
    }

    if (password.length < 6) {
      this.showMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      const response = await fetch('/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone,
          address: address,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage('Registration successful! You can now login.', 'success');
        
        // Switch to login tab
        setTimeout(() => {
          const loginTab = document.getElementById('login-tab');
          if (loginTab) {
            loginTab.click();
          }
          // Pre-fill email in login form
          const loginEmail = document.getElementById('loginEmail');
          if (loginEmail) {
            loginEmail.value = email;
          }
        }, 1000);
        
        // Reset form
        document.getElementById('registerForm').reset();
      } else {
        this.showMessage(data.message || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      this.showMessage('Network error. Please try again.', 'error');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  showMessage(message, type) {
    const messageContainer = document.getElementById('statusMessage');
    if (!messageContainer) {
      console.error('Status message container not found');
      alert(message); // Fallback to browser alert
      return;
    }

    let alertClass = 'alert-info';
    switch (type) {
      case 'success':
        alertClass = 'alert-success';
        break;
      case 'error':
        alertClass = 'alert-danger';
        break;
      case 'warning':
        alertClass = 'alert-warning';
        break;
    }

    messageContainer.innerHTML = `
      <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    // Auto-hide success messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        this.clearMessages();
      }, 5000);
    }
  }

  clearMessages() {
    const messageContainer = document.getElementById('statusMessage');
    if (messageContainer) {
      messageContainer.innerHTML = '';
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  new UserAuth();
});