const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error("❌ MONGODB_URI environment variable is not set");
            return false;
        }
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB connected");
        return true;
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error.message);
        console.error("⚠️ Server will continue to run, but database operations will fail");
        return false;
    }
};

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
});

module.exports = connectDB;
