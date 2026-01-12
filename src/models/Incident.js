const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
    {
        title: String,
        description: String,

        // Link to the service that this incident belongs to
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            index: true,
        },
        serviceName: String, // Denormalized for faster queries

        severity: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "low",
        },

        category: {
            type: String,
            enum: ["performance", "database", "authentication", "network", "deployment"],
        },

        source: {
            type: String,
            enum: ["system", "engineer"],
            default: "system",
        },

        status: {
            type: String,
            enum: ["open", "investigating", "resolved", "auto-resolved"],
            default: "open",
        },

        // Timeline tracking
        timeline: [{
            timestamp: { type: Date, default: Date.now },
            event: String,
            status: String,
            actor: { type: String, enum: ["system", "engineer", "ai"], default: "system" },
            details: mongoose.Schema.Types.Mixed,
        }],

        // Resolution tracking
        resolvedAt: Date,
        resolutionTime: Number, // in milliseconds
        resolvedBy: {
            type: String,
            enum: ["system", "engineer", "ai-auto"],
        },

        // Metadata
        metadata: {
            firstDetectedAt: Date,
            lastUpdatedAt: Date,
            logCount: { type: Number, default: 0 },
            errorCount: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

// Index for faster queries
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ category: 1, severity: 1 });

module.exports = mongoose.model("Incident", incidentSchema);
