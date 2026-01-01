const express = require("express");
const cors = require("cors");

const incidentRoutes = require("./api/incident.routes");
const logRoutes = require("./api/log.routes");
const aiRoutes = require("./api/ai.routes");
const systemRoutes = require("./api/system.routes");
const serviceRoutes = require("./api/service.routes");

const app = express();

// CORS configuration - allow all origins (can be restricted in production)
// For production, you can specify: origin: process.env.FRONTEND_URL
app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
}));
app.use(express.json());

app.use("/api/system", systemRoutes);   // machine
app.use("/api/incidents", incidentRoutes); // engineer
app.use("/api/logs", logRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/services", serviceRoutes); // service management

app.get("/", (_, res) => {
    res.send("AI Incident Assistant API running");
});

module.exports = app;
