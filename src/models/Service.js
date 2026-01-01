const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        url: {
            type: String,
            required: true,
            trim: true,
        },
        healthEndpoint: {
            type: String,
            default: "/health",
        },
        description: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            enum: ["api", "database", "cache", "queue", "storage", "monitoring", "other"],
            default: "api",
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        metadata: {
            tags: [String],
            owner: String,
            team: String,
            environment: {
                type: String,
                enum: ["production", "staging", "development"],
                default: "production",
            },
        },
    },
    { timestamps: true }
);

// Index for faster queries
serviceSchema.index({ enabled: 1, createdAt: -1 });
serviceSchema.index({ url: 1 }, { unique: true });

module.exports = mongoose.model("Service", serviceSchema);

