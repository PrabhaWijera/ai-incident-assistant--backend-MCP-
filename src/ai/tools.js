const Incident = require("../models/Incident");
const Log = require("../models/Log");

// AI tools - READ ONLY (following MCP principles)
// AI can only read data, not modify it
module.exports = {
    getIncidentById: async ({ id }) => {
        try {
            const incident = await Incident.findById(id);
            if (!incident) {
                throw new Error("Incident not found");
            }
            return incident;
        } catch (error) {
            throw new Error(`Failed to get incident: ${error.message}`);
        }
    },
    getLogsByIncident: async ({ incidentId }) => {
        try {
            const logs = await Log.find({ incidentId }).sort({ createdAt: -1 });
            return logs;
        } catch (error) {
            throw new Error(`Failed to get logs: ${error.message}`);
        }
    },
    // Note: updateIncidentStatus removed - AI should be read-only
    // Engineers must manually update status through /api/incidents/:id/status
};
