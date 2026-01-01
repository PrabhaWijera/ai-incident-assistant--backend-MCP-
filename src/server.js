require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const monitoringService = require("./services/monitoring.service");

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // Start continuous monitoring service
    // Wait a bit for DB connection to establish
    setTimeout(() => {
        monitoringService.start();
    }, 2000);
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
