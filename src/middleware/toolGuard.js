// AI tools - READ ONLY (following MCP principles)
const ALLOWED_TOOLS = [
    "getIncidentById",
    "getLogsByIncident",
    // updateIncidentStatus removed - AI should not modify data
];

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
