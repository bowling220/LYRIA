// Performance monitoring and optimization utilities for LYRIA Chat

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
        this.startTime = performance.now();
        this.setupObservers();
    }

    // Setup performance observers
    setupObservers() {
        // Observe loading performance
        if ('PerformanceObserver' in window) {
            try {
                // Navigation timing
                const navObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.recordMetric('navigation', entry.name, entry.duration);
                    });
                });
                navObserver.observe({ entryTypes: ['navigation'] });
                this.observers.push(navObserver);

                // Resource loading
                const resourceObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.name.includes('firebase') || entry.name.includes('.js') || entry.name.includes('.css')) {
                            this.recordMetric('resource', entry.name, entry.duration);
                        }
                    });
                });
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.observers.push(resourceObserver);

                // Long tasks
                if ('longtask' in PerformanceObserver.supportedEntryTypes) {
                    const longTaskObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach(entry => {
                            console.warn('Long task detected:', entry.duration, 'ms');
                            this.recordMetric('longtask', 'task', entry.duration);
                        });
                    });
                    longTaskObserver.observe({ entryTypes: ['longtask'] });
                    this.observers.push(longTaskObserver);
                }
            } catch (error) {
                console.warn('Performance observer setup failed:', error);
            }
        }
    }

    // Record a performance metric
    recordMetric(category, name, value) {
        const key = `${category}_${name}`;
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        this.metrics.get(key).push({
            value,
            timestamp: performance.now()
        });
    }

    // Start timing an operation
    startTiming(label) {
        const startTime = performance.now();
        return {
            end: () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                this.recordMetric('custom', label, duration);
                return duration;
            }
        };
    }

    // Measure Firebase operations
    measureFirebaseOperation(operationName, operation) {
        const timer = this.startTiming(`firebase_${operationName}`);
        
        if (operation && typeof operation.then === 'function') {
            // Handle promises
            return operation
                .then(result => {
                    timer.end();
                    return result;
                })
                .catch(error => {
                    timer.end();
                    throw error;
                });
        } else if (typeof operation === 'function') {
            // Handle synchronous operations
            try {
                const result = operation();
                timer.end();
                return result;
            } catch (error) {
                timer.end();
                throw error;
            }
        }
        
        return operation;
    }

    // Get performance insights
    getInsights() {
        const insights = {
            totalRuntime: performance.now() - this.startTime,
            metrics: {},
            recommendations: []
        };

        // Process metrics
        for (const [key, values] of this.metrics.entries()) {
            const latestValue = values[values.length - 1]?.value || 0;
            const average = values.reduce((sum, item) => sum + item.value, 0) / values.length;
            
            insights.metrics[key] = {
                latest: latestValue,
                average: average,
                count: values.length
            };
        }

        // Generate recommendations
        this.generateRecommendations(insights);

        return insights;
    }

    // Generate performance recommendations
    generateRecommendations(insights) {
        const { metrics } = insights;

        // Check for slow Firebase operations
        Object.keys(metrics).forEach(key => {
            if (key.includes('firebase_') && metrics[key].average > 1000) {
                insights.recommendations.push({
                    type: 'firebase_performance',
                    message: `${key} is averaging ${Math.round(metrics[key].average)}ms. Consider optimization.`,
                    severity: 'medium'
                });
            }
        });

        // Check for long tasks
        if (metrics['longtask_task']) {
            insights.recommendations.push({
                type: 'long_tasks',
                message: `${metrics['longtask_task'].count} long tasks detected. Consider code splitting.`,
                severity: 'high'
            });
        }

        // Check overall runtime
        if (insights.totalRuntime > 30000) {
            insights.recommendations.push({
                type: 'session_length',
                message: 'Long session detected. Consider periodic cleanup.',
                severity: 'low'
            });
        }
    }

    // Optimize images loading
    optimizeImageLoading() {
        const images = document.querySelectorAll('img[src]');
        
        images.forEach(img => {
            // Add loading="lazy" for better performance
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }

            // Add error handling
            if (!img.onerror) {
                img.onerror = () => {
                    console.warn('Failed to load image:', img.src);
                    this.recordMetric('error', 'image_load_failed', 1);
                };
            }
        });
    }

    // Debounce Firebase operations
    debounceFirebaseOperation(fn, delay = 300) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Batch Firebase writes
    createFirebaseBatch() {
        const operations = [];
        let batchTimeout;

        const executeBatch = async () => {
            if (operations.length === 0) return;

            const timer = this.startTiming('firebase_batch_write');
            
            try {
                const batch = firebase.firestore().batch();
                operations.forEach(op => op(batch));
                await batch.commit();
                
                this.recordMetric('firebase', 'batch_size', operations.length);
                operations.length = 0; // Clear operations
            } catch (error) {
                console.error('Batch write failed:', error);
                throw error;
            } finally {
                timer.end();
            }
        };

        return {
            add: (operation) => {
                operations.push(operation);
                
                // Auto-execute batch after delay or when it gets large
                clearTimeout(batchTimeout);
                if (operations.length >= 10) {
                    executeBatch();
                } else {
                    batchTimeout = setTimeout(executeBatch, 1000);
                }
            },
            execute: executeBatch
        };
    }

    // Memory usage monitoring
    monitorMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            this.recordMetric('memory', 'used', memInfo.usedJSHeapSize);
            this.recordMetric('memory', 'total', memInfo.totalJSHeapSize);
            this.recordMetric('memory', 'limit', memInfo.jsHeapSizeLimit);

            const usagePercent = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;
            if (usagePercent > 80) {
                console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
                return true; // High memory usage
            }
        }
        return false;
    }

    // Cleanup resources when memory is high
    performCleanup() {
        // Clear old metrics
        for (const [key, values] of this.metrics.entries()) {
            if (values.length > 100) {
                // Keep only recent entries
                this.metrics.set(key, values.slice(-50));
            }
        }

        // Clear old notifications
        if (window.utils) {
            const oldNotifications = document.querySelectorAll('.notification');
            oldNotifications.forEach(notification => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }

        // Suggest garbage collection if available
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
    }

    // Auto-cleanup based on memory usage
    setupAutoCleanup() {
        setInterval(() => {
            const isHighMemory = this.monitorMemoryUsage();
            if (isHighMemory) {
                this.performCleanup();
            }
        }, 30000); // Check every 30 seconds
    }

    // Report performance to console (for debugging)
    reportToConsole() {
        const insights = this.getInsights();
        console.group('🚀 LYRIA Performance Report');
        console.log('Total Runtime:', Math.round(insights.totalRuntime), 'ms');
        
        console.group('Metrics');
        Object.entries(insights.metrics).forEach(([key, data]) => {
            console.log(`${key}:`, `${Math.round(data.average)}ms avg`, `(${data.count} samples)`);
        });
        console.groupEnd();

        if (insights.recommendations.length > 0) {
            console.group('Recommendations');
            insights.recommendations.forEach(rec => {
                const emoji = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
                console.log(`${emoji} ${rec.message}`);
            });
            console.groupEnd();
        }

        console.groupEnd();
    }

    // Clean up observers
    cleanup() {
        this.observers.forEach(observer => {
            try {
                observer.disconnect();
            } catch (error) {
                console.warn('Error disconnecting observer:', error);
            }
        });
        this.observers = [];
    }
}

// Create global instance
window.performanceMonitor = new PerformanceMonitor();

// Setup auto-cleanup
window.performanceMonitor.setupAutoCleanup();

// Optimize images when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.performanceMonitor.optimizeImageLoading();
    });
} else {
    window.performanceMonitor.optimizeImageLoading();
}

// Report performance in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(() => {
        window.performanceMonitor.reportToConsole();
    }, 5000);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    window.performanceMonitor.cleanup();
});