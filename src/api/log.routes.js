const express = require("express");
const Log = require("../models/Log");

const router = express.Router();

router.get("/:incidentId", async (req, res) => {
    try {
        const logs = await Log.find({ incidentId: req.params.incidentId }).sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        console.error("Error fetching logs:", error);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

module.exports = router;
