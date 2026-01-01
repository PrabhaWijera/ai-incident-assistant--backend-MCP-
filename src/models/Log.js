const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
    {
        incidentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Incident",
            required: true,
        },
        message: String,
        level: {
            type: String,
            enum: ["info", "warning", "error"],
            default: "info",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
