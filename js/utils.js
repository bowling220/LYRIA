// Utility functions for LYRIA Chat
// This module provides error handling, user feedback, and common utilities

class Utils {
    constructor() {
        this.loadingElements = new Set();
        this.setupGlobalErrorHandler();
    }

    // Setup global error handler
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showError('An unexpected error occurred. Please refresh the page.');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showError('A network or processing error occurred.');
            event.preventDefault();
        });
    }

    // Show success message
    showSuccess(message, duration = 5000) {
        this.showNotification(message, 'success', duration);
    }

    // Show error message
    showError(message, duration = 8000) {
        this.showNotification(message, 'error', duration);
    }

    // Show warning message
    showWarning(message, duration = 6000) {
        this.showNotification(message, 'warning', duration);
    }

    // Show info message
    showInfo(message, duration = 4000) {
        this.showNotification(message, 'info', duration);
    }

    // Generic notification system
    showNotification(message, type = 'info', duration = 5000) {
        // Remove existing notifications of the same type
        const existingNotifications = document.querySelectorAll(`.notification.${type}`);
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type} fade-in`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${this.escapeHtml(message)}</span>
                <button class="notification-close" aria-label="Close notification">&times;</button>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(notification);

        // Position the notification
        this.positionNotification(notification);

        // Add event listeners
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.closeNotification(notification));

        // Auto-close after duration
        if (duration > 0) {
            setTimeout(() => this.closeNotification(notification), duration);
        }

        return notification;
    }

    // Get icon for notification type
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Position notification
    positionNotification(notification) {
        const notifications = document.querySelectorAll('.notification');
        const baseTop = 20;
        const spacing = 10;
        const notificationHeight = 60;
        
        const index = Array.from(notifications).indexOf(notification);
        notification.style.cssText = `
            position: fixed;
            top: ${baseTop + (index * (notificationHeight + spacing))}px;
            right: 20px;
            z-index: 2000;
            background: var(--background-color);
            border: 1px solid var(--channel-hover);
            border-radius: var(--border-radius);
            padding: var(--spacing-md);
            box-shadow: var(--shadow-heavy);
            max-width: 400px;
            min-width: 300px;
        `;
    }

    // Close notification
    closeNotification(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.repositionNotifications();
        }, 300);
    }

    // Reposition remaining notifications
    repositionNotifications() {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach((notification, index) => {
            const baseTop = 20;
            const spacing = 10;
            const notificationHeight = 60;
            notification.style.top = `${baseTop + (index * (notificationHeight + spacing))}px`;
        });
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show loading state for an element
    showLoading(element, text = 'Loading...') {
        if (!element) return;

        element.classList.add('loading');
        this.loadingElements.add(element);

        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;

        element.innerHTML = `
            <span class="spinner"></span>
            <span class="loading-text">${this.escapeHtml(text)}</span>
        `;

        element.disabled = true;
    }

    // Hide loading state for an element
    hideLoading(element) {
        if (!element || !this.loadingElements.has(element)) return;

        element.classList.remove('loading');
        this.loadingElements.delete(element);

        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }

        element.disabled = false;
    }

    // Clear all loading states
    clearAllLoading() {
        this.loadingElements.forEach(element => {
            this.hideLoading(element);
        });
    }

    // Async wrapper with error handling
    async handleAsync(asyncFunction, errorMessage = 'Operation failed') {
        try {
            return await asyncFunction();
        } catch (error) {
            console.error('Async operation failed:', error);
            this.showError(errorMessage);
            throw error;
        }
    }

    // Retry mechanism for failed operations
    async retry(asyncFunction, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await asyncFunction();
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt} failed:`, error);
                
                if (attempt < maxAttempts) {
                    await this.delay(delay * attempt); // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }

    // Delay utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Debounce function calls
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    // Throttle function calls
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Sanitize user input
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input.trim().replace(/[<>]/g, '');
    }

    // Generate random ID
    generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Format timestamp
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    // Check if element is in viewport
    isInViewport(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // Smooth scroll to element
    scrollToElement(element, behavior = 'smooth') {
        if (!element) return;
        
        element.scrollIntoView({
            behavior,
            block: 'nearest',
            inline: 'nearest'
        });
    }

    // Local storage wrapper with error handling
    getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Error writing to localStorage:', error);
            return false;
        }
    }

    removeLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Error removing from localStorage:', error);
            return false;
        }
    }

    // Network status checker
    isOnline() {
        return navigator.onLine;
    }

    // Setup network status listeners
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.showSuccess('Back online!');
        });

        window.addEventListener('offline', () => {
            this.showWarning('You are offline. Some features may not work.');
        });
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            this.showSuccess('Copied to clipboard!');
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showError('Failed to copy to clipboard');
            return false;
        }
    }

    // Initialize keyboard navigation helpers
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (event) => {
            // Add keyboard focus class for better focus indicators
            if (event.key === 'Tab') {
                document.body.classList.add('keyboard-focus');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-focus');
        });
    }

    // Clean up resources
    cleanup() {
        this.clearAllLoading();
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => notification.remove());
    }
}

// Export singleton instance
window.utils = new Utils();

// Auto-setup network listeners
window.utils.setupNetworkListeners();
window.utils.setupKeyboardNavigation();