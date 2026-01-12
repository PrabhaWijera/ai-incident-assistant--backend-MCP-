/**
 * Legacy NVIDIA AI Controller (READ-ONLY Wrapper)
 * 
 * This controller provides a REST endpoint for AI analysis requests.
 * It is a thin wrapper around the centralized `aiAnalysis.service.js`.
 * 
 * Historical Context:
 * - Previously this controller directly called NVIDIA NIM APIs and mutated database
 * - Refactored to align with MCP principles: AI analysis is now strictly read-only
 * - All analysis logic moved to `services/aiAnalysis.service.js`
 * 
 * Current Behavior:
 * - Acts as a read-only wrapper - never writes to database
 * - Returns analysis results without modifying incident state
 * - Engineers must use REST APIs to update incident status
 * 
 * Note: Prefer using MCP tools (`/api/mcp/jsonrpc`) over this REST endpoint
 * for better integration with AI agents following MCP protocol.
 */
const { analyzeIncidentReadOnly } = require("../services/aiAnalysis.service");

/**
 * Optional legacy REST handler (READ-ONLY).
 * Prefer using MCP tools over calling this directly.
 */
exports.analyzeIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;

        if (!incidentId) {
            return res.status(400).json({ error: "Incident ID is required" });
        }

        const analysis = await analyzeIncidentReadOnly(incidentId);
        return res.json(analysis);
    } catch (error) {
        console.error("Error analyzing incident (legacy controller):", error);
        return res.status(500).json({ error: "Failed to analyze incident" });
    }
};

