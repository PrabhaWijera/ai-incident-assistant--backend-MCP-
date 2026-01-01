const Incident = require("../models/Incident");
const Log = require("../models/Log");

const analyzeIncident = async (incidentId) => {
    try {
        if (!incidentId) {
            throw new Error("Incident ID is required");
        }

        const incident = await Incident.findById(incidentId);
        if (!incident) {
            throw new Error("Incident not found");
        }

        const logs = await Log.find({ incidentId }).sort({ createdAt: -1 });

        let explanation = "No critical issues detected.";
        let suggestion = null;

        const errorLogs = logs.filter(log => log.level === "error");
        const warningLogs = logs.filter(log => log.level === "warning");

        if (errorLogs.length > 0) {
            explanation = `Multiple error logs detected (${errorLogs.length} errors). Possible system instability.`;
            suggestion = {
                recommendedStatus: "investigating",
                reason: "Errors found in system logs",
            };
        } else if (warningLogs.length > 0) {
            explanation = `Warning logs detected (${warningLogs.length} warnings). Monitor closely.`;
            suggestion = {
                recommendedStatus: incident.status === "open" ? "open" : "investigating",
                reason: "Warnings found in system logs",
            };
        }

        if (incident.status === "investigating" && errorLogs.length === 0 && warningLogs.length === 0) {
            suggestion = {
                recommendedStatus: "resolved",
                reason: "No new errors or warnings detected - issue appears resolved",
            };
        }

        return {
            incident: {
                id: incident._id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                category: incident.category,
            },
            explanation,
            suggestion,
            logsAnalyzed: logs.length,
            errorCount: errorLogs.length,
            warningCount: warningLogs.length,
        };
    } catch (error) {
        throw new Error(`Failed to analyze incident: ${error.message}`);
    }
};

module.exports = analyzeIncident;
