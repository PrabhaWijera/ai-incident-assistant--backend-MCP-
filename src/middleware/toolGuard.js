/**
 * Tool Guard Middleware
 * 
 * Enforces read-only access for AI agents by whitelisting allowed tool actions.
 * This middleware ensures AI cannot perform write operations even if malicious
 * requests are sent.
 * 
 * Following MCP (Model Context Protocol) security principles:
 * - AI agents should only read data
 * - All mutations require explicit engineer approval via REST APIs
 */
const ALLOWED_TOOLS = [
    "getIncidentById",      // Read-only: Fetch incident data
    "getLogsByIncident",   // Read-only: Fetch log data
    // updateIncidentStatus intentionally removed - AI should not modify data
];

/**
 * Express middleware to validate AI tool actions
 * 
 * Checks if the requested action is in the ALLOWED_TOOLS whitelist.
 * Returns 403 Forbidden if action is not allowed.
 */
module.exports = (req, res, next) => {
    const { action } = req.body;

    if (!action) {
        return res.status(400).json({ error: "Action is required" });
    }

    if (!ALLOWED_TOOLS.includes(action)) {
        return res.status(403).json({ 
            error: "Action not allowed for AI agent. AI has read-only access." 
        });
    }

    next();
};
