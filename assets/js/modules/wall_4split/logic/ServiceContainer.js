/**
 * logic/ServiceContainer.js - Lightweight Dependency Injection Container
 * v3.0.0 Modular Refactoring
 */

window.ServiceContainer = {
    services: {},

    /**
     * Register a service/dependency in the container
     * @param {string} name - Service identifier
     * @param {any} service - The service instance or utility object
     */
    register: function(name, service) {
        if (!name || service === undefined) {
            throw new Error(`[ServiceContainer] Invalid service registration: ${name}`);
        }
        this.services[name] = service;
        // console.log(`⚙️ [ServiceContainer] Registered service: ${name}`);
    },

    /**
     * Retrieve a service/dependency from the container
     * @param {string} name - Service identifier
     * @returns {any} The registered service instance or utility object
     */
    get: function(name) {
        const service = this.services[name];
        if (service === undefined) {
            throw new Error(`[ServiceContainer] Service not found: ${name}`);
        }
        return service;
    },

    /**
     * Clear all registered services (primarily for unit testing isolation)
     */
    clear: function() {
        this.services = {};
    }
};
