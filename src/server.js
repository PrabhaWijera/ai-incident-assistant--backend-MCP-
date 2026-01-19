require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const monitoringService = require("./services/monitoring.service");

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Connect to database first, before starting server
        console.log("🔌 Connecting to database...");
        const dbConnected = await connectDB();
        
        if (!dbConnected) {
            console.error("❌ Failed to connect to database. Server cannot start.");
            process.exit(1);
        }
        
        console.log("✅ MongoDB connected");
        
        // Start the HTTP server only after DB connection is established
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            
            // Start monitoring service after both DB and server are ready
            console.log("🔄 Starting continuous monitoring service...");
            monitoringService.start();
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
        
    } catch (error) {
        console.error("❌ Error starting server:", error);
        process.exit(1);
    }
}

startServer();
