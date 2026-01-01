const express = require("express");
const Incident = require("../models/Incident");
const Log = require("../models/Log");
const monitoringService = require("../services/monitoring.service");

const router = express.Router();

/**
 * Simulate system failures
 */
router.post("/events", async (req, res) => {
    try {
        const { type, value } = req.body;

        if (!type) {
            return res.status(400).json({ error: "Event type is required" });
        }

        let incidentData = null;
        let logMessage = "";

        if (type === "CPU_SPIKE") {
            incidentData = {
                title: "High CPU usage detected",
                description: `CPU usage reached ${value || "unknown"}%`,
                severity: "high",
                category: "performance",
                source: "system",
                status: "investigating",
            };
            logMessage = `CPU usage exceeded threshold: ${value || "unknown"}%`;
        } else if (type === "DB_TIMEOUT") {
            incidentData = {
                title: "Database timeout detected",
                description: "Database requests are timing out",
                severity: "high",
                category: "database",
                source: "system",
                status: "investigating",
            };
            logMessage = "Database connection timeout detected";
        } else if (type === "AUTH_FAILURE") {
            incidentData = {
                title: "Authentication failures detected",
                description: "Multiple authentication errors occurred",
                severity: "medium",
                category: "authentication",
                source: "system",
                status: "open",
            };
            logMessage = "Multiple invalid authentication attempts detected";
        } else {
            return res.status(400).json({ error: "Unknown system event type" });
        }

        // Add initial timeline event
        incidentData.timeline = [{
            timestamp: new Date(),
            event: "incident_detected",
            status: incidentData.status,
            actor: "system",
            details: {
                type: type,
                value: value || null,
            },
        }];

        incidentData.metadata = {
            firstDetectedAt: new Date(),
            lastUpdatedAt: new Date(),
            logCount: 1,
            errorCount: 1,
        };

        const incident = await Incident.create(incidentData);

        // System auto-creates log
        await Log.create({
            incidentId: incident._id,
            message: logMessage,
            level: "error",
        });

        res.status(201).json({
            message: "System incident created",
            incident,
        });
    } catch (error) {
        console.error("Error creating system event:", error);
        res.status(500).json({ error: "Failed to create system event" });
    }
});

// Get system statistics
router.get("/stats", async (req, res) => {
    try {
        const totalIncidents = await Incident.countDocuments();
        const openIncidents = await Incident.countDocuments({ status: { $in: ["open", "investigating"] } });
        const resolvedIncidents = await Incident.countDocuments({ status: "resolved" });
        const autoResolvedIncidents = await Incident.countDocuments({ status: "auto-resolved" });

        const incidentsByCategory = await Incident.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);

        const incidentsBySeverity = await Incident.aggregate([
            { $group: { _id: "$severity", count: { $sum: 1 } } },
        ]);

        const averageResolutionTime = await Incident.aggregate([
            { $match: { resolvedAt: { $exists: true } } },
            { $group: { _id: null, avgTime: { $avg: "$resolutionTime" } } },
        ]);

        const recentIncidents = await Incident.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select("title status severity category createdAt");

        res.json({
            summary: {
                totalIncidents,
                openIncidents,
                resolvedIncidents,
                autoResolvedIncidents,
                averageResolutionTime: averageResolutionTime[0]?.avgTime || 0,
            },
            byCategory: incidentsByCategory,
            bySeverity: incidentsBySeverity,
            recentIncidents,
        });
    } catch (error) {
        console.error("Error fetching system stats:", error);
        res.status(500).json({ error: "Failed to fetch system statistics" });
    }
});

// Monitoring service control
router.post("/monitoring/start", async (req, res) => {
    try {
        monitoringService.start();
        res.json({ message: "Monitoring service started" });
    } catch (error) {
        console.error("Error starting monitoring:", error);
        res.status(500).json({ error: "Failed to start monitoring service" });
    }
});

router.post("/monitoring/stop", async (req, res) => {
    try {
        monitoringService.stop();
        res.json({ message: "Monitoring service stopped" });
    } catch (error) {
        console.error("Error stopping monitoring:", error);
        res.status(500).json({ error: "Failed to stop monitoring service" });
    }
});

router.get("/monitoring/status", async (req, res) => {
    try {
        res.json({
            isRunning: monitoringService.isRunning,
            checkInterval: monitoringService.checkInterval,
            healthCheckInterval: monitoringService.healthCheckInterval,
        });
    } catch (error) {
        console.error("Error getting monitoring status:", error);
        res.status(500).json({ error: "Failed to get monitoring status" });
    }
});

module.exports = router;
