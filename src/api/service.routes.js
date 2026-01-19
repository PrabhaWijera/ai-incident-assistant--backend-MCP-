const express = require("express");
const Service = require("../models/Service");
const axios = require("axios");
const dns = require("dns");

const router = express.Router();

// Configure DNS to prefer IPv4
dns.setDefaultResultOrder("ipv4first");

// Helper function to normalize localhost URLs to use 127.0.0.1
function normalizeLocalhostUrl(url) {
    if (!url) return url;
    // Replace localhost with 127.0.0.1 to avoid IPv6 resolution issues
    return url.replace(/localhost/g, "127.0.0.1").replace(/::1/g, "127.0.0.1");
}

/**
 * Get all registered services
 */
router.get("/", async (req, res) => {
    try {
        const { enabled, category, environment } = req.query;
        
        const filter = {};
        if (enabled !== undefined) filter.enabled = enabled === "true";
        if (category) filter.category = category;
        if (environment) filter["metadata.environment"] = environment;

        const services = await Service.find(filter).sort({ createdAt: -1 });

        res.json({
            count: services.length,
            services,
        });
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

/**
 * Get single service by ID
 */
router.get("/:id", async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        
        if (!service) {
            return res.status(404).json({ error: "Service not found" });
        }

        res.json(service);
    } catch (error) {
        console.error("Error fetching service:", error);
        res.status(500).json({ error: "Failed to fetch service" });
    }
});

/**
 * Register a new service
 */
router.post("/", async (req, res) => {
    try {
        const { name, url, healthEndpoint, description, category, metadata } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: "Name and URL are required" });
        }

        // Check if service with this URL already exists
        const existing = await Service.findOne({ url });
        if (existing) {
            return res.status(400).json({ error: "Service with this URL already exists" });
        }

        // Normalize localhost URLs to use 127.0.0.1 to avoid IPv6 issues
        const normalizedUrl = normalizeLocalhostUrl(url.trim());

        const service = await Service.create({
            name,
            url: normalizedUrl,
            healthEndpoint: healthEndpoint || "/health",
            description,
            category: category || "api",
            metadata: metadata || {},
            enabled: true,
        });

        res.status(201).json({
            message: "Service registered successfully",
            service,
        });
    } catch (error) {
        console.error("Error registering service:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Service with this URL already exists" });
        }
        res.status(500).json({ error: "Failed to register service" });
    }
});

/**
 * Update service
 */
router.patch("/:id", async (req, res) => {
    try {
        const { name, url, healthEndpoint, description, category, enabled, metadata } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (url) updateData.url = normalizeLocalhostUrl(url.trim());
        if (healthEndpoint) updateData.healthEndpoint = healthEndpoint;
        if (description !== undefined) updateData.description = description;
        if (category) updateData.category = category;
        if (enabled !== undefined) updateData.enabled = enabled;
        if (metadata) updateData.metadata = { ...updateData.metadata, ...metadata };

        const service = await Service.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!service) {
            return res.status(404).json({ error: "Service not found" });
        }

        res.json({
            message: "Service updated successfully",
            service,
        });
    } catch (error) {
        console.error("Error updating service:", error);
        if (error.code === 11000) {
            return res.status(400).json({ error: "Service with this URL already exists" });
        }
        res.status(500).json({ error: "Failed to update service" });
    }
});

/**
 * Delete service
 */
router.delete("/:id", async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);

        if (!service) {
            return res.status(404).json({ error: "Service not found" });
        }

        res.json({
            message: "Service deleted successfully",
            service,
        });
    } catch (error) {
        console.error("Error deleting service:", error);
        res.status(500).json({ error: "Failed to delete service" });
    }
});

/**
 * Test service health check - checks multiple endpoints
 */
router.post("/:id/test", async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ error: "Service not found" });
        }

        // Check multiple endpoints for comprehensive testing
        const endpointsToCheck = [
            { path: "/health", name: "overall health" },
            { path: "/api", name: "API subsystem" },
            { path: "/db", name: "database subsystem" },
            { path: "/auth", name: "auth subsystem" }
        ];

        // Normalize URL to use 127.0.0.1 instead of localhost
        const baseUrl = normalizeLocalhostUrl(service.url.replace(/\/$/, "")); // Remove trailing slash
        const results = [];
        let allHealthy = true;

        for (const endpoint of endpointsToCheck) {
            const healthUrl = `${baseUrl}${endpoint.path}`;
            const startTime = Date.now();

            try {
                const response = await axios.get(healthUrl, {
                    timeout: 5000,
                    validateStatus: () => true,
                });
                const responseTime = Date.now() - startTime;

                const isHealthy = response.status === 200 && 
                                 (response.data?.status === "healthy" || response.data?.status === "degraded");

                if (!isHealthy) {
                    allHealthy = false;
                }

                results.push({
                    endpoint: endpoint.path,
                    name: endpoint.name,
                    url: healthUrl,
                    status: response.status,
                    responseTime,
                    healthy: isHealthy,
                    data: response.data,
                });
            } catch (error) {
                allHealthy = false;
                results.push({
                    endpoint: endpoint.path,
                    name: endpoint.name,
                    url: healthUrl,
                    status: "error",
                    error: error.message,
                    healthy: false,
                });
            }
        }

        res.json({
            service: service.name,
            baseUrl: baseUrl,
            allHealthy: allHealthy,
            endpoints: results,
            summary: {
                total: results.length,
                healthy: results.filter(r => r.healthy).length,
                unhealthy: results.filter(r => !r.healthy).length
            }
        });
    } catch (error) {
        console.error("Error testing service:", error);
        res.status(500).json({ error: "Failed to test service" });
    }
});

module.exports = router;

