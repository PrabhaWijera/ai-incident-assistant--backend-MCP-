require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const monitoringService = require("./services/monitoring.service");

const PORT = process.env.PORT || 5000;

// Start server first (non-blocking)
const server = app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // Connect to database (non-blocking)
    const dbConnected = await connectDB();
    
    if (dbConnected) {
        // Start continuous monitoring service only if DB is connected
        // Wait a bit for DB connection to fully establish
        setTimeout(() => {
            monitoringService.start();
        }, 2000);
    } else {
        console.log("⚠️ Monitoring service will not start until database is connected");
    }
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    monitoringService.stop();
    server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("SIGINT signal received: closing HTTP server");
    monitoringService.stop();
    server.close(() => {
        console.log("HTTP server closed");
        process.exit(0);
    });
});
