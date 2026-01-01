const Incident = require("../models/Incident");
const Log = require("../models/Log");
const { analyzeSeverity, analyzeCategory, analyzeRootCause } = require("../huggins/huggingface.client");

// Note: analyzeRootCause is now imported from huggingface.client.js (AI-powered)

// Find related incidents
async function findRelatedIncidents(incident, logs) {
    const relatedIncidents = [];
    
    // Find incidents with same category
    const sameCategory = await Incident.find({
        category: incident.category,
        _id: { $ne: incident._id },
        status: { $in: ["open", "investigating"] },
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .select("_id title status severity");

    relatedIncidents.push(...sameCategory.map(inc => inc._id));

    // Find recently resolved similar incidents
    const similarResolved = await Incident.find({
        category: incident.category,
        severity: incident.severity,
        status: "resolved",
        _id: { $ne: incident._id },
        resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    })
    .sort({ resolvedAt: -1 })
    .limit(2)
    .select("_id");

    relatedIncidents.push(...similarResolved.map(inc => inc._id));

    return [...new Set(relatedIncidents)]; // Remove duplicates
}

// Generate suggested actions
function generateSuggestedActions(incident, logs, rootCause) {
    const actions = [];
    const errorCount = logs.filter(l => l.level === "error").length;
    const warningCount = logs.filter(l => l.level === "warning").length;

    // Action 1: Investigate based on severity
    if (incident.severity === "high" || errorCount > 5) {
        actions.push({
            action: "investigate_immediately",
            description: "Immediate investigation required due to high severity or multiple errors",
            confidence: 0.9,
            requiresApproval: false, // Status change doesn't need approval
        });
    }

    // Action 2: Restart service (if applicable)
    if (rootCause.includes("timeout") || rootCause.includes("connection")) {
        actions.push({
            action: "restart_service",
            description: "Restart affected service to clear connection issues",
            confidence: 0.7,
            requiresApproval: true,
        });
    }

    // Action 3: Scale resources
    if (rootCause.includes("Resource exhaustion") || rootCause.includes("CPU") || rootCause.includes("memory")) {
        actions.push({
            action: "scale_resources",
            description: "Scale up resources (CPU/Memory) to handle increased load",
            confidence: 0.75,
            requiresApproval: true,
        });
    }

    // Action 4: Auto-resolve if stable
    if (incident.status === "investigating" && errorCount === 0 && warningCount < 2) {
        const timeSinceLastError = logs.length > 0 
            ? Date.now() - new Date(logs[0].createdAt).getTime()
            : 0;
        
        if (timeSinceLastError > 30 * 60 * 1000) { // 30 minutes
            actions.push({
                action: "auto_resolve",
                description: "No new errors detected for 30+ minutes - incident appears resolved",
                confidence: 0.8,
                requiresApproval: true,
            });
        }
    }

    // Action 5: Check database
    if (rootCause.includes("Database")) {
        actions.push({
            action: "check_database",
            description: "Review database query performance and connection pool status",
            confidence: 0.85,
            requiresApproval: false,
        });
    }

    return actions;
}

// Trend analysis
function analyzeTrend(logs) {
    if (logs.length < 3) {
        return { isDegrading: false, degradationRate: 0 };
    }

    // Count errors over time windows
    const now = Date.now();
    const last5min = logs.filter(l => now - new Date(l.createdAt).getTime() < 5 * 60 * 1000);
    const last15min = logs.filter(l => now - new Date(l.createdAt).getTime() < 15 * 60 * 1000);
    const last30min = logs.filter(l => now - new Date(l.createdAt).getTime() < 30 * 60 * 1000);

    const errorRate5min = last5min.filter(l => l.level === "error").length / Math.max(last5min.length, 1);
    const errorRate15min = last15min.filter(l => l.level === "error").length / Math.max(last15min.length, 1);
    const errorRate30min = last30min.filter(l => l.level === "error").length / Math.max(last30min.length, 1);

    // If error rate is increasing, system is degrading
    const isDegrading = errorRate5min > errorRate15min && errorRate15min > errorRate30min;
    const degradationRate = isDegrading ? (errorRate5min - errorRate30min) : 0;

    return { isDegrading, degradationRate };
}

exports.analyzeIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;

        if (!incidentId) {
            return res.status(400).json({ error: "Incident ID is required" });
        }

        const incident = await Incident.findById(incidentId);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const logs = await Log.find({ incidentId }).sort({ createdAt: -1 });

        const text = `
            ${incident.title || ""}.
            ${incident.description || ""}.
            ${logs.map(l => l.message).join(" ")}
        `.trim();

        if (!text || text.length < 10) {
            return res.status(400).json({ error: "Insufficient data for analysis" });
        }

        console.log("\n" + "=".repeat(60));
        console.log(`🚀 [AI Analysis] Starting analysis for incident: ${incidentId}`);
        console.log(`📝 [AI Analysis] Incident: "${incident.title}"`);
        console.log(`📊 [AI Analysis] Analyzing ${logs.length} log entries`);
        console.log("=".repeat(60));

        // Enhanced AI analysis
        const severity = await analyzeSeverity(text);
        const category = await analyzeCategory(text);
        const { rootCause, rootCauseProbability } = await analyzeRootCause(incident, logs);
        const relatedIncidentIds = await findRelatedIncidents(incident, logs);
        const suggestedActions = generateSuggestedActions(incident, logs, rootCause);
        const trendAnalysis = analyzeTrend(logs);

        // Update incident with AI analysis
        const aiAnalysis = {
            rootCause,
            rootCauseProbability,
            relatedIncidentIds,
            suggestedActions,
            trendAnalysis,
        };

        // Add timeline event for AI analysis
        const timelineEvent = {
            timestamp: new Date(),
            event: "ai_analysis_completed",
            status: incident.status,
            actor: "ai",
            details: {
                rootCause,
                severity,
                category,
                suggestedActionsCount: suggestedActions.length,
            },
        };

        await Incident.findByIdAndUpdate(
            incidentId,
            {
                aiAnalysis,
                $push: { timeline: timelineEvent },
                "metadata.lastUpdatedAt": new Date(),
            },
            { new: true }
        );

        // Generate primary suggestion
        let primarySuggestion = null;
        if (suggestedActions.length > 0) {
            const topAction = suggestedActions[0];
            primarySuggestion = {
                recommendedStatus: incident.severity === "high" ? "investigating" : incident.status,
                reason: topAction.description,
                action: topAction.action,
            };
        }

        console.log("=".repeat(60));
        console.log(`✅ [AI Analysis] Analysis complete for incident: ${incidentId}`);
        console.log(`📊 [AI Analysis] Results:`);
        console.log(`   - Severity: ${severity.toUpperCase()}`);
        console.log(`   - Category: ${category.toUpperCase()}`);
        console.log(`   - Root Cause: ${rootCause} (${(rootCauseProbability * 100).toFixed(0)}% confidence)`);
        console.log(`   - Suggested Actions: ${suggestedActions.length}`);
        console.log(`   - Related Incidents: ${relatedIncidentIds.length}`);
        console.log("=".repeat(60) + "\n");

        res.json({
            incident: {
                id: incident._id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                category: incident.category,
            },
            aiAnalysis: {
                aiSeverity: severity,
                aiCategory: category,
                rootCause,
                rootCauseProbability,
                relatedIncidentIds,
                suggestedActions,
                trendAnalysis,
            },
            explanation: `AI analyzed ${logs.length} log entries. Detected ${severity.toLowerCase()} severity issue in ${category} category. Root cause: ${rootCause} (${(rootCauseProbability * 100).toFixed(0)}% confidence).`,
            suggestion: primarySuggestion,
            logsAnalyzed: logs.length,
            errorCount: logs.filter(l => l.level === "error").length,
            warningCount: logs.filter(l => l.level === "warning").length,
        });
    } catch (error) {
        console.error("Error analyzing incident:", error);
        res.status(500).json({ error: "Failed to analyze incident" });
    }
};
