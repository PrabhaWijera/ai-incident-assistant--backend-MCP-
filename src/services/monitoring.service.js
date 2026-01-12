const Incident = require("../models/Incident");
const Log = require("../models/Log");
const Service = require("../models/Service");
const axios = require("axios");

/**
 * Continuous Monitoring Service
 * Monitors all registered services from the database and performs health checks
 */
class MonitoringService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.checkInterval = 60000; // Check every 60 seconds (1 minute)
        this.healthCheckInterval = 300000; // Full health check every 5 minutes
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
     */
    async monitorExternalServices() {
        try {
            // Fetch all enabled services from database
            const services = await Service.find({ enabled: true });

            if (services.length === 0) {
                console.log("📋 No services registered for monitoring");
                return;
            }

            console.log(`🔍 Monitoring ${services.length} service(s)...`);

            for (const service of services) {
                try {
                    const healthUrl = `${service.url}${service.healthEndpoint || "/health"}`;
                    console.log(`🔍 Checking ${service.name} at ${healthUrl}...`);

                    const response = await axios.get(healthUrl, {
                        timeout: 5000, // 5 second timeout
                        validateStatus: () => true // Accept any status code
                    });

                    const healthData = response.data;
                    const isHealthy = response.status === 200 && healthData?.status === "healthy";

                    if (!isHealthy) {
                        await this.handleServiceUnhealthy(service, healthData, response.status);
                    } else {
                        console.log(`✅ ${service.name} is healthy`);
                    }
                } catch (error) {
                    // Service is unreachable
                    await this.handleServiceUnreachable(service, error);
                }
            }
        } catch (error) {
            console.error("❌ Error fetching services for monitoring:", error);
        }
    }

    /**
     * Handle unhealthy service
     */
    async handleServiceUnhealthy(service, healthData, statusCode) {
        console.log(`⚠️ ${service.name} is UNHEALTHY (Status: ${statusCode})`);

        // Check if we already have an open incident for this service
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

        // Check if we already have an open incident
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
        const incidentData = {
            title: `${service.name} - Service Unreachable`,
            description: `Service at ${service.url} is not responding: ${error.message}`,
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
                    error: error.message
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

