const express = require("express");
const Incident = require("../models/Incident");
const Log = require("../models/Log");
const monitoringService = require("../services/monitoring.service");

const router = express.Router();

// Get simplified system statistics (essential metrics only)
router.get("/stats", async (req, res) => {
    try {
        const totalIncidents = await Incident.countDocuments();
        const openIncidents = await Incident.countDocuments({ status: { $in: ["open", "investigating"] } });
        const resolvedIncidents = await Incident.countDocuments({ status: "resolved", resolvedBy: "engineer" });
        const totalLogs = await Log.countDocuments();

        res.json({
            summary: {
                totalIncidents,
                openIncidents,
                resolvedIncidents,
                totalLogs,
            },
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
