const Incident = require("../models/Incident");
const Log = require("../models/Log");
const Service = require("../models/Service");
const axios = require("axios");
const dns = require("dns");

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder("ipv4first");

// Helper function to normalize localhost URLs to use 127.0.0.1
function normalizeLocalhostUrl(url) {
    if (!url) return url;
    // Replace localhost with 127.0.0.1 to avoid IPv6 resolution issues
    return url.replace(/localhost/g, "127.0.0.1").replace(/::1/g, "127.0.0.1");
}

/**
 * Continuous Monitoring Service
 * Monitors all registered services from the database and performs health checks
 */
class MonitoringService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.checkInterval = 60000; // Check every 60 seconds (1 minute)
        this.healthCheckInterval = 60000; // Full health check every 1 minute
    }

    /**
     * Start continuous monitoring
     */
    start() {
        if (this.isRunning) {
            console.log("⚠️ Monitoring service already running");
            return;
        }

        this.isRunning = true;
        console.log("🔄 Starting continuous monitoring service...");

        // Periodic health checks
        this.intervalId = setInterval(async () => {
            await this.performHealthCheck();
        }, this.healthCheckInterval);

        // Immediate first check
        this.performHealthCheck();

        console.log(`✅ Monitoring service started (checks every ${this.healthCheckInterval / 1000}s)`);
    }

    /**
     * Stop continuous monitoring
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log("🛑 Monitoring service stopped");
    }

    /**
     * Perform system health check
     */
    async performHealthCheck() {
        try {
            console.log("🔍 Performing system health check...");

            // Monitor external services (demo company server, etc.)
            await this.monitorExternalServices();

            console.log("✅ Health check completed");
        } catch (error) {
            console.error("❌ Error in health check:", error);
        }
    }

    /**
     * Monitor external services - fetches all enabled services from database
     * Checks multiple endpoints: /health (overall), /api, /db, /auth
     */
    async monitorExternalServices() {
        try {
            // Fetch all enabled services from database
            const allServices = await Service.find({ enabled: true });

            // Filter out services that are on old/unavailable ports
            const activeServices = allServices.filter(service => {
                // Check if service URL contains known old ports
                const isOldPort = service.url.includes(':3001') || 
                                  service.url.includes(':3002') ||
                                  service.url.includes('localhost:3001') ||
                                  service.url.includes('127.0.0.1:3001');
                if (isOldPort) {
                    console.log(`⚠️ Skipping service ${service.name} on old port: ${service.url}`);
                    return false;
                }
                return true;
            });

            if (activeServices.length === 0) {
                console.log("📋 No active services available for monitoring");
                return;
            }

            console.log(`🔍 Monitoring ${activeServices.length}/${allServices.length} active service(s)...`);

            for (const service of activeServices) {
                // Check multiple endpoints for comprehensive monitoring
                const endpointsToCheck = [
                    { path: "/health", name: "overall health" },
                    { path: "/api", name: "API subsystem" },
                    { path: "/db", name: "database subsystem" },
                    { path: "/auth", name: "auth subsystem" }
                ];

                let hasAnyFailure = false;
                const endpointResults = [];

                for (const endpoint of endpointsToCheck) {
                    // Normalize URL to use 127.0.0.1 instead of localhost
                    const baseUrl = normalizeLocalhostUrl(service.url.replace(/\/$/, "")); // Remove trailing slash
                    const healthUrl = `${baseUrl}${endpoint.path}`;
                    try {
                        const response = await axios.get(healthUrl, {
                            timeout: 5000, // 5 second timeout
                            validateStatus: () => true, // Accept any status code
                        });

                        const healthData = response.data;
                        const isHealthy = response.status === 200 && 
                                         (healthData?.status === "healthy" || healthData?.status === "degraded");

                        endpointResults.push({
                            endpoint: endpoint.path,
                            name: endpoint.name,
                            healthy: isHealthy,
                            status: response.status,
                            data: healthData
                        });

                        if (!isHealthy) {
                            hasAnyFailure = true;
                            console.log(`⚠️ ${service.name} - ${endpoint.name} is unhealthy (${endpoint.path})`);
                        } else {
                            console.log(`✅ ${service.name} - ${endpoint.name} is healthy`);
                        }
                    } catch (error) {
                        hasAnyFailure = true;
                        // Handle different types of connection errors
                        const errorMessage = error.code === 'ECONNREFUSED' 
                            ? `Service unreachable: Connection refused on ${baseUrl}${endpoint.path}`
                            : error.code === 'ECONNRESET'
                            ? `Service connection reset: ${baseUrl}${endpoint.path}`
                            : error.code === 'ETIMEDOUT'
                            ? `Service timed out: ${baseUrl}${endpoint.path}`
                            : error.message;
                                        
                        endpointResults.push({
                            endpoint: endpoint.path,
                            name: endpoint.name,
                            healthy: false,
                            error: errorMessage
                        });
                        console.log(`❌ ${service.name} - ${endpoint.name} is unreachable (${endpoint.path}): ${errorMessage}`);
                    }
                }

                // If any endpoint failed, create/update incident
                if (hasAnyFailure) {
                    await this.handleServiceEndpointFailures(service, endpointResults);
                }
            }
        } catch (error) {
            console.error("❌ Error fetching services for monitoring:", error);
        }
    }

    /**
     * Handle service endpoint failures (multiple endpoints checked)
     */
    async handleServiceEndpointFailures(service, endpointResults) {
        const failedEndpoints = endpointResults.filter(r => !r.healthy);
        const failedEndpointNames = failedEndpoints.map(e => e.name).join(", ");
        
        // Clean up old incidents for this service
        const cleanedUpCount = await this.cleanupOldIncidents(service._id);
        if (cleanedUpCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedUpCount} old incidents for service: ${service.name}`);
        }
        
        // Check if we already have an open incident after cleanup
        const existingIncident = await Incident.findOne({
            serviceId: service._id,
            status: { $in: ["open", "investigating"] }
        });

        const failureDetails = {
            failedEndpoints: failedEndpoints.map(e => ({
                path: e.endpoint,
                name: e.name,
                status: e.status,
                error: e.error,
                data: e.data
            })),
            successfulEndpoints: endpointResults.filter(r => r.healthy).map(e => e.name)
        };

        if (existingIncident) {
            // Update existing incident with new log
            await Log.create({
                incidentId: existingIncident._id,
                message: `Health check failed for: ${failedEndpointNames}. Failed endpoints: ${failedEndpoints.map(e => e.endpoint).join(", ")}`,
                level: "error"
            });

            await Incident.findByIdAndUpdate(existingIncident._id, {
                "metadata.lastUpdatedAt": new Date(),
                $inc: { "metadata.logCount": 1, "metadata.errorCount": 1 }
            });

            console.log(`📝 Updated existing incident for ${service.name}`);
            return;
        }

        // Determine severity based on failed endpoints
        const severity = this.determineSeverityFromEndpoints(failedEndpoints);
        const category = this.determineCategoryFromEndpoints(failedEndpoints);

        // Create new incident
        const incidentData = {
            title: `${service.name} - Health Check Failed`,
            description: `Service health check failed for: ${failedEndpointNames}. Check individual endpoints for details.`,
            serviceId: service._id,
            serviceName: service.name,
            severity: severity,
            category: category,
            source: "system",
            status: "open",
            timeline: [{
                timestamp: new Date(),
                event: "incident_detected",
                status: "open",
                actor: "system",
                details: {
                    service: service.name,
                    serviceId: service._id.toString(),
                    url: service.url,
                    failedEndpoints: failureDetails.failedEndpoints,
                    successfulEndpoints: failureDetails.successfulEndpoints
                }
            }],
            metadata: {
                firstDetectedAt: new Date(),
                lastUpdatedAt: new Date(),
                logCount: 1,
                errorCount: failedEndpoints.length
            }
        };

        const incident = await Incident.create(incidentData);

        await Log.create({
            incidentId: incident._id,
            message: `Health check failed for endpoints: ${failedEndpoints.map(e => `${e.name} (${e.endpoint})`).join(", ")}`,
            level: "error"
        });

        console.log(`🔔 Created incident for ${service.name}: ${incident._id}`);
    }

    /**
     * Determine severity based on failed endpoints
     */
    determineSeverityFromEndpoints(failedEndpoints) {
        // If /health (overall) or /db fails, it's high severity
        const criticalEndpoints = failedEndpoints.filter(e => 
            e.endpoint === "/health" || e.endpoint === "/db"
        );
        if (criticalEndpoints.length > 0) return "high";
        
        // If multiple endpoints fail, it's high severity
        if (failedEndpoints.length >= 2) return "high";
        
        // Single non-critical endpoint failure is medium
        return "medium";
    }

    /**
     * Determine category based on failed endpoints
     */
    determineCategoryFromEndpoints(failedEndpoints) {
        const endpointCategories = {
            "/api": "performance",
            "/db": "database",
            "/auth": "authentication",
            "/health": "performance"
        };

        // Prioritize database and auth failures
        if (failedEndpoints.some(e => e.endpoint === "/db")) return "database";
        if (failedEndpoints.some(e => e.endpoint === "/auth")) return "authentication";
        if (failedEndpoints.some(e => e.endpoint === "/api")) return "performance";
        
        return "performance";
    }

    /**
     * Handle unhealthy service (legacy method, kept for backward compatibility)
     */
    async handleServiceUnhealthy(service, healthData, statusCode) {
        console.log(`⚠️ ${service.name} is UNHEALTHY (Status: ${statusCode})`);

        // Clean up old incidents for this service
        const cleanedUpCount = await this.cleanupOldIncidents(service._id);
        if (cleanedUpCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedUpCount} old incidents for service: ${service.name}`);
        }
        
        // Check if we already have an open incident after cleanup
        const existingIncident = await Incident.findOne({
            serviceId: service._id,
            status: { $in: ["open", "investigating"] }
        });

        if (existingIncident) {
            // Update existing incident with new log
            await Log.create({
                incidentId: existingIncident._id,
                message: `Health check failed: ${healthData?.message || "Service unhealthy"} (Status: ${statusCode})`,
                level: "error"
            });

            await Incident.findByIdAndUpdate(existingIncident._id, {
                "metadata.lastUpdatedAt": new Date(),
                $inc: { "metadata.logCount": 1, "metadata.errorCount": 1 }
            });

            console.log(`📝 Updated existing incident for ${service.name}`);
            return;
        }

        // Create new incident
        const incidentData = {
            title: `${service.name} - Health Check Failed`,
            description: healthData?.message || `Service returned unhealthy status (${statusCode})`,
            serviceId: service._id,
            serviceName: service.name,
            severity: this.determineSeverity(healthData, statusCode),
            category: this.determineCategory(healthData),
            source: "system",
            status: "open",
            timeline: [{
                timestamp: new Date(),
                event: "incident_detected",
                status: "open",
                actor: "system",
                details: {
                    service: service.name,
                    serviceId: service._id.toString(),
                    url: service.url,
                    statusCode: statusCode,
                    healthData: healthData
                }
            }],
            metadata: {
                firstDetectedAt: new Date(),
                lastUpdatedAt: new Date(),
                logCount: 1,
                errorCount: 1
            }
        };

        const incident = await Incident.create(incidentData);

        await Log.create({
            incidentId: incident._id,
            message: `Health check failed: ${healthData?.message || "Service unhealthy"} (Response time: ${healthData?.responseTime || "N/A"}ms)`,
            level: "error"
        });

        console.log(`🔔 Created incident for ${service.name}: ${incident._id}`);
    }

    /**
     * Handle unreachable service
     */
    async handleServiceUnreachable(service, error) {
        console.log(`❌ ${service.name} is UNREACHABLE: ${error.message}`);

        // Clean up old incidents for this service
        const cleanedUpCount = await this.cleanupOldIncidents(service._id);
        if (cleanedUpCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedUpCount} old incidents for service: ${service.name}`);
        }

        // Check if we already have an open incident after cleanup
        const existingIncident = await Incident.findOne({
            serviceId: service._id,
            status: { $in: ["open", "investigating"] }
        });

        if (existingIncident) {
            await Log.create({
                incidentId: existingIncident._id,
                message: `Service unreachable: ${error.message}`,
                level: "error"
            });

            await Incident.findByIdAndUpdate(existingIncident._id, {
                "metadata.lastUpdatedAt": new Date(),
                $inc: { "metadata.logCount": 1, "metadata.errorCount": 1 }
            });
            return;
        }

        // Create new incident
        const errorMessage = error.code === 'ECONNREFUSED' 
            ? `Service unreachable: Connection refused on ${service.url}`
            : error.code === 'ECONNRESET'
            ? `Service connection reset: ${service.url}`
            : error.code === 'ETIMEDOUT'
            ? `Service timed out: ${service.url}`
            : error.message;
        
        const incidentData = {
            title: `${service.name} - Service Unreachable`,
            description: `Service at ${service.url} is not responding: ${errorMessage}`,
            serviceId: service._id,
            serviceName: service.name,
            severity: "high",
            category: "network",
            source: "system",
            status: "open",
            timeline: [{
                timestamp: new Date(),
                event: "incident_detected",
                status: "open",
                actor: "system",
                details: {
                    service: service.name,
                    serviceId: service._id.toString(),
                    url: service.url,
                    error: errorMessage
                }
            }],
            metadata: {
                firstDetectedAt: new Date(),
                lastUpdatedAt: new Date(),
                logCount: 1,
                errorCount: 1
            }
        };

        const incident = await Incident.create(incidentData);

        await Log.create({
            incidentId: incident._id,
            message: `Service unreachable: ${error.message}`,
            level: "error"
        });

        console.log(`🔔 Created incident for unreachable ${service.name}: ${incident._id}`);
    }

    /**
     * Clean up old incidents for a service
     */
    async cleanupOldIncidents(serviceId) {
        try {
            // Find all open incidents for this service
            const oldIncidents = await Incident.find({
                serviceId: serviceId,
                status: { $in: ["open", "investigating"] }
            });
            
            // Close all old incidents
            for (const incident of oldIncidents) {
                await Incident.findByIdAndUpdate(incident._id, {
                    status: "closed",
                    "timeline": [...incident.timeline, {
                        timestamp: new Date(),
                        event: "incident_closed",
                        status: "closed",
                        actor: "system",
                        details: {
                            reason: "Cleanup: Replacing old incident with fresh monitoring"
                        }
                    }],
                    "metadata.lastUpdatedAt": new Date()
                });
                
                // Create a log entry for closure
                await Log.create({
                    incidentId: incident._id,
                    message: "Incident closed during monitoring cleanup",
                    level: "info"
                });
                
                console.log(`🧹 Closed old incident for service: ${incident._id}`);
            }
            
            return oldIncidents.length;
        } catch (error) {
            console.error("❌ Error cleaning up old incidents:", error);
            return 0;
        }
    }

    /**
     * Determine severity based on health data
     */
    determineSeverity(healthData, statusCode) {
        if (statusCode >= 500) return "high";
        if (healthData.responseTime > 2000) return "high";
        if (healthData.memory?.heapUsed > 500) return "medium";
        return "medium";
    }

    /**
     * Determine category based on health data
     */
    determineCategory(healthData) {
        if (healthData.memory?.heapUsed > 500) return "performance";
        if (healthData.responseTime > 2000) return "performance";
        if (healthData.activeFailureModes?.includes("database")) return "database";
        if (healthData.activeFailureModes?.includes("auth")) return "authentication";
        if (healthData.activeFailureModes?.includes("network")) return "network";
        return "performance";
    }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;

