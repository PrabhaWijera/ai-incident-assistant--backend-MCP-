const Incident = require("../models/Incident");
const Log = require("../models/Log");

/**
 * AI Tools Module (READ-ONLY Operations)
 * 
 * This module provides read-only database access functions for AI agents.
 * Following MCP (Model Context Protocol) principles, AI agents should only
 * read data, never modify it. All write operations must go through REST APIs
 * with explicit engineer approval.
 * 
 * All functions in this module:
 * - Only perform database queries (find, findById, etc.)
 * - Never perform mutations (save, update, delete, create)
 * - Return data without side effects
 */
module.exports = {
    /**
     * Get incident by MongoDB ID (READ-ONLY)
     * 
     * @param {object} args - Arguments object
     * @param {string} args.id - Incident MongoDB ObjectId
     * @returns {Promise<object>} Incident document
     * @throws {Error} If incident not found or query fails
     */
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
    
    /**
     * Get logs associated with an incident (READ-ONLY)
     * 
     * @param {object} args - Arguments object
     * @param {string} args.incidentId - Incident MongoDB ObjectId
     * @returns {Promise<array>} Array of log documents, sorted by creation date (newest first)
     * @throws {Error} If query fails
     */
    getLogsByIncident: async ({ incidentId }) => {
        try {
            const logs = await Log.find({ incidentId }).sort({ createdAt: -1 });
            return logs;
        } catch (error) {
            throw new Error(`Failed to get logs: ${error.message}`);
        }
    },
    
    // NOTE: updateIncidentStatus intentionally removed
    // AI agents should NOT modify incident status. Engineers must use:
    // PATCH /api/incidents/:id/status to update status with proper audit trail
};
