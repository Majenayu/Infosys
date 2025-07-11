// Delivery Partner Login/Register System
class DeliveryAuth {
    constructor() {
        this.init();
    }

    init() {
        console.log('Delivery Auth System initialized');
        this.bindEvents();
        this.checkElements();
    }

    checkElements() {
        // Check if all required elements exist
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const statusMessage = document.getElementById('statusMessage');
        
        console.log('Form elements check:', {
            loginForm: !!loginForm,
            registerForm: !!registerForm,
            statusMessage: !!statusMessage
        });
    }

    bindEvents() {
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form submission
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Tab switching
        const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => this.clearMessages());
        });
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            this.showMessage('Logging in...', 'info');
            
            const response = await fetch('/delivery/login', {
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
                console.log('Login successful, user data:', data.user);
                
                // Store user data in localStorage
                localStorage.setItem('deliveryPartner', JSON.stringify(data.user));
                localStorage.setItem('deliveryUserEmail', data.user.email);
                
                // Redirect to scan page after a short delay
                setTimeout(() => {
                    console.log('Redirecting to scan page...');
                    window.location.href = '/scan';
                }, 1500);
            } else {
                console.error('Login failed:', data);
                this.showMessage(data.message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async testLogin() {
        // Test function to check if login is working
        console.log('Testing login functionality...');
        try {
            const response = await fetch('/delivery/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'test123'
                })
            });
            
            const data = await response.json();
            console.log('Test login response:', data);
        } catch (error) {
            console.error('Test login error:', error);
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const phone = document.getElementById('registerPhone').value;
        const address = document.getElementById('registerAddress').value;
        const vehicleType = document.getElementById('registerVehicleType').value;
        const license = document.getElementById('registerLicense').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        // Validation
        if (!name || !email || !phone || !address || !vehicleType || !license || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
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

        try {
            this.showMessage('Registering...', 'info');
            
            const response = await fetch('/delivery/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    address: address,
                    vehicleType: vehicleType,
                    license: license,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Registration successful! You can now login.', 'success');
                
                // Clear the form
                document.getElementById('registerForm').reset();
                
                // Switch to login tab
                setTimeout(() => {
                    const loginTab = document.getElementById('login-tab');
                    if (loginTab) {
                        loginTab.click();
                    }
                }, 2000);
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
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }

    showMessage(message, type) {
        const messageContainer = document.getElementById('statusMessage');
        if (!messageContainer) {
            console.error('Status message container not found');
            console.log('Message:', message, 'Type:', type);
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

// Initialize the delivery auth system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const deliveryAuth = new DeliveryAuth();
    
    // Add test button for debugging
    if (window.location.search.includes('debug')) {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Login';
        testButton.className = 'btn btn-secondary mt-2';
        testButton.onclick = () => deliveryAuth.testLogin();
        document.body.appendChild(testButton);
    }
});