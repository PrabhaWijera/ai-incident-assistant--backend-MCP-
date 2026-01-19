const Incident = require("../models/Incident");
const Log = require("../models/Log");
const {
    analyzeSeverity,
    analyzeCategory,
    analyzeRootCause,
} = require("../nvidia/navidia.client");

/**
 * Centralized AI Analysis Service (READ-ONLY)
 * 
 * This service provides AI-powered incident analysis using NVIDIA NIM APIs.
 * It is designed to be strictly read-only - it never modifies database state.
 * 
 * Key Design Principles:
 * 1. READ-ONLY: All operations are queries only, no mutations
 * 2. NVIDIA NIM Integration: Uses Llama 3.1 and Mistral models via NVIDIA NIM API
 * 3. Advisory Only: Returns recommendations, never auto-applies changes
 * 4. Human-in-the-Loop: Engineers must explicitly approve any actions via REST APIs
 * 
 * Status Recommendations:
 * The service returns safe, advisory status suggestions (not actual status changes):
 *  - needs_investigation: Incident requires engineer attention
 *  - likely_root_cause_identified: AI has identified probable root cause
 *  - ready_for_resolution: Incident appears stable and may be resolved
 * 
 * Engineers must use PATCH /api/incidents/:id/status to actually change incident status.
 * 
 * @param {string} incidentId - MongoDB ObjectId of the incident to analyze
 * @returns {Promise<object>} Analysis result object with AI insights (read-only)
 * @throws {Error} If incident not found or insufficient data for analysis
 */
async function analyzeIncidentReadOnly(incidentId) {
    if (!incidentId) {
        throw new Error("Incident ID is required");
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) {
        throw new Error("Incident not found");
    }

    const logs = await Log.find({ incidentId }).sort({ createdAt: -1 });

    // Build free-text context for the LLM
    const text = `
        ${incident.title || ""}.
        ${incident.description || ""}.
        ${logs.map((l) => l.message).join(" ")}
    `.trim();

    if (!text || text.length < 10) {
        throw new Error("Insufficient data for analysis");
    }

    console.log("\n" + "=".repeat(60));
    console.log(`🚀 [AI Analysis] Starting READ-ONLY analysis for incident: ${incidentId}`);
    console.log(`📝 [AI Analysis] Incident: "${incident.title}"`);
    console.log(`📊 [AI Analysis] Analyzing ${logs.length} log entries`);
    console.log("=".repeat(60));

    // Call NVIDIA NIM APIs for AI analysis (with automatic fallbacks)
    // These functions try NVIDIA models first, then fall back to rule-based analysis
    const severity = await analyzeSeverity(text);
    const category = await analyzeCategory(text);
    const { rootCause, rootCauseProbability } = await analyzeRootCause(
        incident,
        logs
    );

    const relatedIncidentIds = await findRelatedIncidents(incident, logs);
    const suggestedActions = generateSuggestedActions(incident, logs, rootCause);
    const trendAnalysis = analyzeTrend(logs);

    // Derive a SAFE, advisory status suggestion
    const statusSuggestion = deriveStatusSuggestion(
        incident,
        logs,
        severity,
        trendAnalysis
    );

    const analysis = {
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
            statusSuggestion,
        },
        explanation: `AI analyzed ${logs.length} log entries. Detected ${severity.toLowerCase()} severity issue in ${category} category. Root cause: ${rootCause} (${(
            rootCauseProbability * 100
        ).toFixed(0)}% confidence).`,
        logsAnalyzed: logs.length,
        errorCount: logs.filter((l) => l.level === "error").length,
        warningCount: logs.filter((l) => l.level === "warning").length,
    };

    console.log("=".repeat(60));
    console.log(
        `✅ [AI Analysis] READ-ONLY analysis complete for incident: ${incidentId}`
    );
    console.log("=".repeat(60) + "\n");

    return analysis;
}

// ============================================================================
// Internal Helper Functions (All Read-Only)
// ============================================================================
// These functions only perform database queries - no mutations allowed

/**
 * Find related incidents based on category and status
 * 
 * Used to help engineers identify patterns and similar past incidents.
 * This is a read-only query operation.
 */
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

    relatedIncidents.push(...sameCategory.map((inc) => inc._id));

    // Find recently resolved similar incidents
    const similarResolved = await Incident.find({
        category: incident.category,
        severity: incident.severity,
        status: "resolved",
        resolvedBy: "engineer", // Only include manually resolved incidents
        _id: { $ne: incident._id },
        resolvedAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
    })
        .sort({ resolvedAt: -1 })
        .limit(2)
        .select("_id");

    relatedIncidents.push(...similarResolved.map((inc) => inc._id));

    return [...new Set(relatedIncidents)];
}

/**
 * Generate suggested remediation actions based on AI analysis
 * 
 * Returns advisory action recommendations. These are NOT automatically executed.
 * Engineers must explicitly approve actions via POST /api/incidents/:id/approve-action
 * 
 * All actions include:
 * - action: Machine-readable action identifier
 * - description: Human-readable explanation
 * - confidence: AI confidence score (0.0-1.0)
 * - requiresApproval: Whether action needs explicit engineer approval
 */
function generateSuggestedActions(incident, logs, rootCause) {
    const actions = [];
    const errorCount = logs.filter((l) => l.level === "error").length;
    const warningCount = logs.filter((l) => l.level === "warning").length;

    // Action 1: Investigate based on severity
    if (incident.severity === "high" || errorCount > 5) {
        actions.push({
            action: "investigate_immediately",
            description:
                "Immediate investigation required due to high severity or multiple errors",
            confidence: 0.9,
            requiresApproval: false,
        });
    }

    // Action 2: Restart service (if applicable)
    if (rootCause && (rootCause.includes("timeout") || rootCause.includes("connection"))) {
        actions.push({
            action: "restart_service",
            description: "Restart affected service to clear connection issues",
            confidence: 0.7,
            requiresApproval: true,
        });
    }

    // Action 3: Scale resources
    if (
        rootCause &&
        (rootCause.includes("Resource exhaustion") ||
            rootCause.includes("CPU") ||
            rootCause.includes("memory"))
    ) {
        actions.push({
            action: "scale_resources",
            description:
                "Scale up resources (CPU/Memory) to handle increased load",
            confidence: 0.75,
            requiresApproval: true,
        });
    }

    // Action 4: Check database
    if (rootCause && rootCause.includes("Database")) {
        actions.push({
            action: "check_database",
            description:
                "Review database query performance and connection pool status",
            confidence: 0.85,
            requiresApproval: false,
        });
    }

    // Action 5: Auto-resolve-style hint (but still requires human resolution)
    const timeWindowStableMs = 30 * 60 * 1000; // 30 minutes
    const recentLogs = logs;
    if (incident.status === "investigating" && recentLogs.length > 0) {
        const errorLogs = recentLogs.filter((l) => l.level === "error");
        const warningLogs = recentLogs.filter((l) => l.level === "warning");

        const timeSinceLastError =
            errorLogs.length > 0
                ? Date.now() - new Date(errorLogs[0].createdAt).getTime()
                : Date.now() - new Date(recentLogs[0].createdAt).getTime();

        if (errorLogs.length === 0 && warningLogs.length < 2 && timeSinceLastError > timeWindowStableMs) {
            actions.push({
                action: "consider_resolving",
                description:
                    "No new errors detected for 30+ minutes - incident appears stable; engineer may consider resolution",
                confidence: 0.8,
                requiresApproval: true,
            });
        }
    }

    return actions;
}

/**
 * Analyze log trends to detect system degradation
 * 
 * Compares error rates across time windows (5min, 15min, 30min) to detect
 * if the system is getting worse over time.
 * 
 * Returns: { isDegrading: boolean, degradationRate: number }
 */
function analyzeTrend(logs) {
    if (logs.length < 3) {
        return { isDegrading: false, degradationRate: 0 };
    }

    const now = Date.now();
    const last5min = logs.filter(
        (l) => now - new Date(l.createdAt).getTime() < 5 * 60 * 1000
    );
    const last15min = logs.filter(
        (l) => now - new Date(l.createdAt).getTime() < 15 * 60 * 1000
    );
    const last30min = logs.filter(
        (l) => now - new Date(l.createdAt).getTime() < 30 * 60 * 1000
    );

    const errorRate5min =
        last5min.filter((l) => l.level === "error").length /
        Math.max(last5min.length, 1);
    const errorRate15min =
        last15min.filter((l) => l.level === "error").length /
        Math.max(last15min.length, 1);
    const errorRate30min =
        last30min.filter((l) => l.level === "error").length /
        Math.max(last30min.length, 1);

    const isDegrading =
        errorRate5min > errorRate15min && errorRate15min > errorRate30min;
    const degradationRate = isDegrading ? errorRate5min - errorRate30min : 0;

    return { isDegrading, degradationRate };
}

/**
 * Derive safe, advisory status suggestion from analysis signals
 * 
 * This function maps AI analysis results into safe status recommendations.
 * These are ADVISORY ONLY - engineers must explicitly update status via REST API.
 * 
 * Returns one of:
 *  - needs_investigation: High severity or degrading trend detected
 *  - likely_root_cause_identified: Medium severity with identified root cause
 *  - ready_for_resolution: Low severity, stable trend, no recent errors
 * 
 * Note: This does NOT modify the incident status in the database.
 */
function deriveStatusSuggestion(incident, logs, severity, trendAnalysis) {
    const errorCount = logs.filter((l) => l.level === "error").length;

    if (severity === "high" || errorCount > 5 || trendAnalysis.isDegrading) {
        return "needs_investigation";
    }

    if (severity === "medium" && errorCount > 0) {
        return "likely_root_cause_identified";
    }

    // Low severity, stable trend, and mostly clean logs -> ready for human review to resolve
    if (!trendAnalysis.isDegrading && errorCount === 0) {
        return "ready_for_resolution";
    }

    // Default conservative stance
    return "needs_investigation";
}

module.exports = {
    analyzeIncidentReadOnly,
};

