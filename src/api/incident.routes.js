const express = require("express");
const Incident = require("../models/Incident");
const Log = require("../models/Log");

const router = express.Router();

// ⚠️ REMOVED: Manual incident creation
// Incidents are now ONLY created by system events (/api/system/events)
// This ensures all incidents are automatically detected, not manually created
// Engineers can only view and manage existing incidents

// Get all incidents with optional filters

// Engineer views incidents with filters
router.get("/", async (req, res) => {
    try {
        const { status, severity, category, serviceId, limit = 50 } = req.query;
        
        const filter = {};
        if (status) filter.status = status;
        if (severity) filter.severity = severity;
        if (category) filter.category = category;
        if (serviceId) filter.serviceId = serviceId;

        const incidents = await Incident.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate("serviceId", "name url category")
            .populate("aiAnalysis.relatedIncidentIds", "title status severity");

        res.json({
            count: incidents.length,
            incidents,
        });
    } catch (error) {
        console.error("Error fetching incidents:", error);
        res.status(500).json({ error: "Failed to fetch incidents" });
    }
});

// Engineer views single incident with full details
router.get("/:id", async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id)
            .populate("aiAnalysis.relatedIncidentIds", "title status severity createdAt");
        
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        // Get logs for this incident
        const logs = await Log.find({ incidentId: incident._id }).sort({ createdAt: -1 });

        res.json({
            incident,
            logs,
            timeline: incident.timeline || [],
            summary: {
                totalLogs: logs.length,
                errorLogs: logs.filter(l => l.level === "error").length,
                warningLogs: logs.filter(l => l.level === "warning").length,
                duration: incident.resolvedAt 
                    ? incident.resolvedAt - incident.createdAt 
                    : Date.now() - incident.createdAt,
            },
        });
    } catch (error) {
        console.error("Error fetching incident:", error);
        res.status(500).json({ error: "Failed to fetch incident" });
    }
});

// Engineer updates status (with timeline tracking)
router.patch("/:id/status", async (req, res) => {
    try {
        const { status, notes } = req.body;
        const validStatuses = ["open", "investigating", "resolved"];

        if (!status) {
            return res.status(400).json({ error: "Status is required" });
        }

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status. Must be: open, investigating, or resolved" });
        }

        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        const oldStatus = incident.status;
        
        // Update status and timeline
        const updateData = {
            status,
            "metadata.lastUpdatedAt": new Date(),
        };

        // Track resolution
        if (status === "resolved" && oldStatus !== "resolved") {
            updateData.resolvedAt = new Date();
            updateData.resolutionTime = Date.now() - incident.createdAt;
            updateData.resolvedBy = "engineer";
        }

        // Add timeline event
        const timelineEvent = {
            timestamp: new Date(),
            event: "status_change",
            status: status,
            actor: "engineer",
            details: {
                from: oldStatus,
                to: status,
                notes: notes || null,
            },
        };

        updateData.$push = { timeline: timelineEvent };

        const updatedIncident = await Incident.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        // System auto-creates log
        await Log.create({
            incidentId: incident._id,
            message: `Status updated from ${oldStatus} to ${status}${notes ? ` - ${notes}` : ""}`,
            level: "info",
        });

        res.json(updatedIncident);
    } catch (error) {
        console.error("Error updating incident status:", error);
        res.status(500).json({ error: "Failed to update incident status" });
    }
});

// Approve AI-suggested action
router.post("/:id/approve-action", async (req, res) => {
    try {
        const { actionIndex } = req.body;
        const incident = await Incident.findById(req.params.id);

        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        if (!incident.aiAnalysis?.suggestedActions || !incident.aiAnalysis.suggestedActions[actionIndex]) {
            return res.status(400).json({ error: "Invalid action index" });
        }

        const action = incident.aiAnalysis.suggestedActions[actionIndex];
        
        // Add timeline event
        const timelineEvent = {
            timestamp: new Date(),
            event: "ai_action_approved",
            status: incident.status,
            actor: "engineer",
            details: {
                action: action.action,
                description: action.description,
                approved: true,
            },
        };

        await Incident.findByIdAndUpdate(
            req.params.id,
            {
                $push: { timeline: timelineEvent },
                "metadata.lastUpdatedAt": new Date(),
            },
            { new: true }
        );

        // System auto-creates log
        await Log.create({
            incidentId: incident._id,
            message: `AI action approved: ${action.action} - ${action.description}`,
            level: "info",
        });

        res.json({
            message: "Action approved",
            action,
            note: "Action execution should be handled by your automation system",
        });
    } catch (error) {
        console.error("Error approving action:", error);
        res.status(500).json({ error: "Failed to approve action" });
    }
});

// Get incident history and related incidents
router.get("/:id/history", async (req, res) => {
    try {
        const incident = await Incident.findById(req.params.id);
        if (!incident) {
            return res.status(404).json({ error: "Incident not found" });
        }

        // Get related incidents
        const relatedIncidents = await Incident.find({
            _id: { $in: incident.aiAnalysis?.relatedIncidentIds || [] },
        }).select("title status severity createdAt resolvedAt");

        // Get similar incidents (same category, resolved)
        const similarIncidents = await Incident.find({
            category: incident.category,
            status: "resolved",
            _id: { $ne: incident._id },
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title status severity createdAt resolvedAt resolutionTime");

        res.json({
            incident: {
                id: incident._id,
                title: incident.title,
                timeline: incident.timeline || [],
            },
            relatedIncidents,
            similarIncidents,
            statistics: {
                averageResolutionTime: similarIncidents.length > 0
                    ? similarIncidents.reduce((sum, inc) => sum + (inc.resolutionTime || 0), 0) / similarIncidents.length
                    : null,
            },
        });
    } catch (error) {
        console.error("Error fetching incident history:", error);
        res.status(500).json({ error: "Failed to fetch incident history" });
    }
});

module.exports = router;
