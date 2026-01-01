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

            // Check for open incidents that might need attention
            const openIncidents = await Incident.find({
                status: { $in: ["open", "investigating"] },
            }).sort({ createdAt: -1 });

            // Check for incidents that might be auto-resolvable
            for (const incident of openIncidents) {
                await this.checkIncidentHealth(incident);
            }

            // Monitor external services (demo company server, etc.)
            await this.monitorExternalServices();

            // Simulate random system events (for demo purposes - can be disabled)
            if (process.env.ENABLE_RANDOM_EVENTS !== "false") {
                await this.simulateSystemEvents();
            }

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

    /**
     * Check individual incident health
     */
    async checkIncidentHealth(incident) {
        try {
            const logs = await Log.find({ incidentId: incident._id })
                .sort({ createdAt: -1 })
                .limit(10);

            if (logs.length === 0) return;

            const recentLogs = logs.filter(
                l => Date.now() - new Date(l.createdAt).getTime() < 30 * 60 * 1000
            );

            const recentErrors = recentLogs.filter(l => l.level === "error");
            const recentWarnings = recentLogs.filter(l => l.level === "warning");

            // Auto-resolve if no errors for 30+ minutes
            if (
                incident.status === "investigating" &&
                recentErrors.length === 0 &&
                recentWarnings.length < 2
            ) {
                const lastErrorTime = logs.find(l => l.level === "error")?.createdAt;
                if (lastErrorTime) {
                    const timeSinceLastError = Date.now() - new Date(lastErrorTime).getTime();
                    if (timeSinceLastError > 30 * 60 * 1000) {
                        await this.autoResolveIncident(incident);
                    }
                }
            }

            // Detect slow degradation
            if (recentWarnings.length > recentErrors.length * 2 && recentWarnings.length > 5) {
                await this.detectSlowDegradation(incident, logs);
            }
        } catch (error) {
            console.error(`Error checking incident ${incident._id}:`, error);
        }
    }

    /**
     * Auto-resolve incident if stable
     */
    async autoResolveIncident(incident) {
        try {
            const timelineEvent = {
                timestamp: new Date(),
                event: "auto_resolve_detected",
                status: "resolved",
                actor: "system",
                details: {
                    reason: "No errors detected for 30+ minutes - system appears stable",
                    autoResolved: true,
                },
            };

            await Incident.findByIdAndUpdate(
                incident._id,
                {
                    status: "auto-resolved",
                    resolvedAt: new Date(),
                    resolutionTime: Date.now() - incident.createdAt,
                    resolvedBy: "ai-auto",
                    $push: { timeline: timelineEvent },
                    "metadata.lastUpdatedAt": new Date(),
                },
                { new: true }
            );

            await Log.create({
                incidentId: incident._id,
                message: "Incident auto-resolved: No errors detected for 30+ minutes",
                level: "info",
            });

            console.log(`✅ Auto-resolved incident: ${incident.title}`);
        } catch (error) {
            console.error(`Error auto-resolving incident ${incident._id}:`, error);
        }
    }

    /**
     * Detect slow degradation patterns
     */
    async detectSlowDegradation(incident, logs) {
        try {
            // Check if we already detected this
            const recentTimeline = incident.timeline?.slice(-5) || [];
            const alreadyDetected = recentTimeline.some(
                e => e.event === "slow_degradation_detected"
            );

            if (alreadyDetected) return;

            const timelineEvent = {
                timestamp: new Date(),
                event: "slow_degradation_detected",
                status: incident.status,
                actor: "system",
                details: {
                    warningCount: logs.filter(l => l.level === "warning").length,
                    errorCount: logs.filter(l => l.level === "error").length,
                    message: "Slow degradation pattern detected - increasing warning frequency",
                },
            };

            await Incident.findByIdAndUpdate(
                incident._id,
                {
                    $push: { timeline: timelineEvent },
                    "metadata.lastUpdatedAt": new Date(),
                },
                { new: true }
            );

            await Log.create({
                incidentId: incident._id,
                message: "Slow degradation detected: Increasing warning frequency observed",
                level: "warning",
            });

            console.log(`⚠️ Slow degradation detected for incident: ${incident.title}`);
        } catch (error) {
            console.error(`Error detecting degradation for incident ${incident._id}:`, error);
        }
    }

    /**
     * Simulate random system events (for demo/testing)
     * In production, this would be replaced with real monitoring integrations
     */
    async simulateSystemEvents() {
        // Only simulate if no recent incidents (to avoid spam)
        const recentIncidents = await Incident.find({
            createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // Last 10 minutes
        });

        if (recentIncidents.length > 0) {
            return; // Don't create new incidents if recent ones exist
        }

        // Random chance to simulate an event (10% chance per check)
        if (Math.random() > 0.1) {
            return;
        }

        const eventTypes = [
            { type: "CPU_SPIKE", value: Math.floor(Math.random() * 20) + 85 },
            { type: "DB_TIMEOUT", value: null },
            { type: "AUTH_FAILURE", value: null },
        ];

        const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];

        // Create incident via system API pattern
        try {
            let incidentData = null;
            let logMessage = "";

            if (randomEvent.type === "CPU_SPIKE") {
                incidentData = {
                    title: "High CPU usage detected",
                    description: `CPU usage reached ${randomEvent.value}%`,
                    severity: "high",
                    category: "performance",
                    source: "system",
                    status: "open",
                };
                logMessage = `CPU usage exceeded threshold: ${randomEvent.value}%`;
            } else if (randomEvent.type === "DB_TIMEOUT") {
                incidentData = {
                    title: "Database timeout detected",
                    description: "Database requests are timing out",
                    severity: "high",
                    category: "database",
                    source: "system",
                    status: "open",
                };
                logMessage = "Database connection timeout detected";
            } else if (randomEvent.type === "AUTH_FAILURE") {
                incidentData = {
                    title: "Authentication failures detected",
                    description: "Multiple authentication errors occurred",
                    severity: "medium",
                    category: "authentication",
                    source: "system",
                    status: "open",
                };
                logMessage = "Multiple invalid authentication attempts detected";
            }

            if (incidentData) {
                incidentData.timeline = [{
                    timestamp: new Date(),
                    event: "incident_detected",
                    status: incidentData.status,
                    actor: "system",
                    details: {
                        type: randomEvent.type,
                        value: randomEvent.value,
                        source: "monitoring_service",
                    },
                }];

                incidentData.metadata = {
                    firstDetectedAt: new Date(),
                    lastUpdatedAt: new Date(),
                    logCount: 1,
                    errorCount: 1,
                };

                const incident = await Incident.create(incidentData);

                await Log.create({
                    incidentId: incident._id,
                    message: logMessage,
                    level: "error",
                });

                console.log(`🔔 Simulated system event: ${randomEvent.type} - Incident created`);
            }
        } catch (error) {
            console.error("Error simulating system event:", error);
        }
    }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;

