const express = require("express");
const { analyzeIncident } = require("../huggins/ai.controller");

const router = express.Router();

router.get("/analysis/:incidentId", analyzeIncident);

module.exports = router;
