/**
 * NVIDIA NIM API Client
 * 
 * This file provides AI analysis using NVIDIA NIM (NVIDIA Inference Microservices) APIs.
 * It replaces the previous HuggingFace integration.
 * 
 * API Key: Can be set via NVIDIA_NIM_API_KEY environment variable
 * Default: Uses provided API key if env var not set
 */
const axios = require("axios");

// NVIDIA NIM API Configuration
const NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || "";
const NIM_BASE_URL = "https://integrate.api.nvidia.com";

// Model Configuration
const PRIMARY_MODEL = "meta/llama-3.1-8b-instruct"; // Primary: Best for classification + reasoning
const SECONDARY_MODEL = "mistralai/mistral-7b-instruct"; // Secondary: Backup for quick classification

const NIM_HEADERS = {
    Authorization: `Bearer ${NIM_API_KEY}`,
    "Content-Type": "application/json",
};

// Check if NVIDIA NIM API is available
let nimApiAvailable = true;

/**
 * Call NVIDIA NIM API for severity analysis
 * @param {string} model - Model to use
 * @param {string} prompt - Prompt text
 * @returns {Promise<string|null>} - Severity or null if failed
 */
async function callNIMForSeverity(model, prompt) {
    const modelName = model === PRIMARY_MODEL ? "Llama 3.1" : "Mistral";
    console.log(`🤖 [AI Analysis] Attempting severity analysis with ${modelName}...`);
    
    try {
        const { data } = await axios.post(
            `${NIM_BASE_URL}/v1/chat/completions`,
            {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                max_tokens: 10,
            },
            {
                headers: NIM_HEADERS,
                timeout: 15000, // 15 second timeout
            }
        );

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            console.log(`❌ [AI Analysis] ${modelName} returned invalid response format`);
            return null;
        }

        const response = data.choices[0].message.content.trim().toLowerCase();

        // Parse the response
        let severity = null;
        if (response.includes("high")) {
            severity = "high";
        } else if (response.includes("medium")) {
            severity = "medium";
        } else if (response.includes("low")) {
            severity = "low";
        }

        if (severity) {
            console.log(`✅ [AI Analysis] ${modelName} successfully classified severity as: ${severity.toUpperCase()}`);
            return severity;
        }

        console.log(`❌ [AI Analysis] ${modelName} returned unexpected response: "${response}"`);
        return null;
    } catch (error) {
        // Check for authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
            nimApiAvailable = false;
            console.log(`❌ [AI Analysis] ${modelName} - Authentication failed (${error.response?.status}). Disabling API calls.`);
        } else if (error.response?.status) {
            console.log(`❌ [AI Analysis] ${modelName} - API error (${error.response?.status}): ${error.message}`);
        } else {
            console.log(`❌ [AI Analysis] ${modelName} - Request failed: ${error.message}`);
        }
        // Return null to trigger fallback
        return null;
    }
}

/**
 * Analyze incident severity using NVIDIA NIM API
 * Tries primary model first, then secondary, then fallback
 * Returns: "high", "medium", or "low"
 */
async function analyzeSeverity(text) {
    console.log("📊 [AI Analysis] Starting severity analysis...");
    
    // Use fallback immediately if API is known to be unavailable
    if (!nimApiAvailable || !NIM_API_KEY) {
        console.log("⚠️ [AI Analysis] API unavailable, using rule-based fallback for severity");
        return analyzeSeverityFallback(text);
    }

    if (!text || typeof text !== "string") {
        console.log("⚠️ [AI Analysis] Invalid text input, using rule-based fallback for severity");
        return analyzeSeverityFallback(text);
    }

    // Truncate text if too long (NIM has token limits)
    const truncatedText = text.length > 1000 ? text.substring(0, 1000) + "..." : text;

    const prompt = `Classify the severity of this incident as HIGH, MEDIUM, or LOW. 
Respond with only one word: HIGH, MEDIUM, or LOW.

Incident description: ${truncatedText}

Severity:`;

    // Try PRIMARY model first (Llama 3.1 - best for classification + reasoning)
    console.log("🔵 [AI Analysis] Trying PRIMARY model: Llama 3.1 8B Instruct");
    let result = await callNIMForSeverity(PRIMARY_MODEL, prompt);
    if (result) {
        return result;
    }

    // Try SECONDARY model (Mistral - backup for quick classification)
    console.log("🟡 [AI Analysis] Primary model failed, trying SECONDARY model: Mistral 7B Instruct");
    result = await callNIMForSeverity(SECONDARY_MODEL, prompt);
    if (result) {
        return result;
    }

    // Both models failed - log and use fallback
    console.log("🟠 [AI Analysis] Both AI models failed. Switching to rule-based pattern matching for severity...");
    const fallbackResult = analyzeSeverityFallback(text);
    console.log(`✅ [AI Analysis] Rule-based analysis classified severity as: ${fallbackResult.toUpperCase()}`);
    
    // Final fallback to rule-based analysis
    return fallbackResult;
}

/**
 * Fallback severity analysis using pattern matching
 */
function analyzeSeverityFallback(text) {
    if (!text || typeof text !== "string") {
        return "low";
    }

    const lowerText = text.toLowerCase();
    if (
        lowerText.includes("critical") ||
        lowerText.includes("down") ||
        lowerText.includes("failure") ||
        lowerText.includes("outage") ||
        lowerText.includes("severe") ||
        lowerText.includes("emergency") ||
        lowerText.includes("crash") ||
        lowerText.includes("unavailable")
    ) {
        return "high";
    }
    if (
        lowerText.includes("error") ||
        lowerText.includes("warning") ||
        lowerText.includes("issue") ||
        lowerText.includes("problem") ||
        lowerText.includes("slow") ||
        lowerText.includes("degraded")
    ) {
        return "medium";
    }
    return "low";
}

/**
 * Call NVIDIA NIM API for category analysis
 * @param {string} model - Model to use
 * @param {string} prompt - Prompt text
 * @returns {Promise<string|null>} - Category or null if failed
 */
async function callNIMForCategory(model, prompt) {
    const modelName = model === PRIMARY_MODEL ? "Llama 3.1" : "Mistral";
    console.log(`🤖 [AI Analysis] Attempting category analysis with ${modelName}...`);
    
    try {
        const { data } = await axios.post(
            `${NIM_BASE_URL}/v1/chat/completions`,
            {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                max_tokens: 20,
            },
            {
                headers: NIM_HEADERS,
                timeout: 15000, // 15 second timeout
            }
        );

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            console.log(`❌ [AI Analysis] ${modelName} returned invalid response format`);
            return null;
        }

        const response = data.choices[0].message.content.trim().toLowerCase();

        // Validate response is one of the allowed categories
        const validCategories = ["database", "network", "authentication", "deployment", "performance"];
        const matchedCategory = validCategories.find((cat) => response.includes(cat));

        if (matchedCategory) {
            console.log(`✅ [AI Analysis] ${modelName} successfully classified category as: ${matchedCategory.toUpperCase()}`);
            return matchedCategory;
        }

        console.log(`❌ [AI Analysis] ${modelName} returned unexpected category: "${response}"`);
        return null;
    } catch (error) {
        // Check for authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
            nimApiAvailable = false;
            console.log(`❌ [AI Analysis] ${modelName} - Authentication failed (${error.response?.status}). Disabling API calls.`);
        } else if (error.response?.status) {
            console.log(`❌ [AI Analysis] ${modelName} - API error (${error.response?.status}): ${error.message}`);
        } else {
            console.log(`❌ [AI Analysis] ${modelName} - Request failed: ${error.message}`);
        }
        // Return null to trigger fallback
        return null;
    }
}

/**
 * Analyze incident category using NVIDIA NIM API
 * Tries primary model first, then secondary, then fallback
 * Returns: "database", "network", "authentication", "deployment", "performance"
 */
async function analyzeCategory(text) {
    console.log("📊 [AI Analysis] Starting category analysis...");
    
    // Use fallback immediately if API is known to be unavailable
    if (!nimApiAvailable || !NIM_API_KEY) {
        console.log("⚠️ [AI Analysis] API unavailable, using rule-based fallback for category");
        return analyzeCategoryFallback(text);
    }

    if (!text || typeof text !== "string") {
        console.log("⚠️ [AI Analysis] Invalid text input, using rule-based fallback for category");
        return analyzeCategoryFallback(text);
    }

    // Truncate text if too long
    const truncatedText = text.length > 1000 ? text.substring(0, 1000) + "..." : text;

    const prompt = `Classify this incident into one of these categories: database, network, authentication, deployment, performance.
Respond with only the category name (lowercase, one word).

Categories:
- database: Issues with databases, queries, data storage
- network: Network connectivity, timeouts, DNS, HTTP issues
- authentication: Login, credentials, tokens, authorization problems
- deployment: Build, CI/CD, container, deployment issues
- performance: CPU, memory, speed, resource usage issues

Incident description: ${truncatedText}

Category:`;

    // Try PRIMARY model first (Llama 3.1 - best for classification + reasoning)
    console.log("🔵 [AI Analysis] Trying PRIMARY model: Llama 3.1 8B Instruct");
    let result = await callNIMForCategory(PRIMARY_MODEL, prompt);
    if (result) {
        return result;
    }

    // Try SECONDARY model (Mistral - backup for quick classification)
    console.log("🟡 [AI Analysis] Primary model failed, trying SECONDARY model: Mistral 7B Instruct");
    result = await callNIMForCategory(SECONDARY_MODEL, prompt);
    if (result) {
        return result;
    }

    // Both models failed - log and use fallback
    console.log("🟠 [AI Analysis] Both AI models failed. Switching to rule-based pattern matching for category...");
    const fallbackResult = analyzeCategoryFallback(text);
    console.log(`✅ [AI Analysis] Rule-based analysis classified category as: ${fallbackResult.toUpperCase()}`);
    
    // Final fallback to rule-based analysis
    return fallbackResult;
}

/**
 * Fallback category analysis using pattern matching
 */
function analyzeCategoryFallback(text) {
    if (!text || typeof text !== "string") {
        return "performance"; // Default to performance
    }

    const lowerText = text.toLowerCase();

    // Database patterns
    if (
        lowerText.includes("database") ||
        lowerText.includes("db ") ||
        lowerText.includes("sql") ||
        lowerText.includes("query") ||
        lowerText.includes("mongodb") ||
        lowerText.includes("postgres") ||
        lowerText.includes("mysql") ||
        lowerText.includes("connection pool") ||
        lowerText.includes("transaction")
    ) {
        return "database";
    }

    // Authentication patterns
    if (
        lowerText.includes("auth") ||
        lowerText.includes("login") ||
        lowerText.includes("password") ||
        lowerText.includes("credential") ||
        lowerText.includes("token") ||
        lowerText.includes("session") ||
        lowerText.includes("unauthorized") ||
        lowerText.includes("forbidden") ||
        lowerText.includes("jwt")
    ) {
        return "authentication";
    }

    // Network patterns
    if (
        lowerText.includes("network") ||
        lowerText.includes("connection") ||
        lowerText.includes("timeout") ||
        lowerText.includes("dns") ||
        lowerText.includes("http") ||
        lowerText.includes("tcp") ||
        lowerText.includes("socket") ||
        lowerText.includes("packet") ||
        lowerText.includes("latency")
    ) {
        return "network";
    }

    // Performance patterns
    if (
        lowerText.includes("cpu") ||
        lowerText.includes("memory") ||
        lowerText.includes("performance") ||
        lowerText.includes("slow") ||
        lowerText.includes("throughput") ||
        lowerText.includes("resource") ||
        lowerText.includes("load") ||
        lowerText.includes("spike")
    ) {
        return "performance";
    }

    // Deployment patterns
    if (
        lowerText.includes("deploy") ||
        lowerText.includes("build") ||
        lowerText.includes("ci/cd") ||
        lowerText.includes("pipeline") ||
        lowerText.includes("container") ||
        lowerText.includes("docker") ||
        lowerText.includes("kubernetes") ||
        lowerText.includes("k8s")
    ) {
        return "deployment";
    }

    return "performance"; // Default fallback
}

/**
 * Call NVIDIA NIM API for root cause analysis
 * @param {string} model - Model to use
 * @param {string} prompt - Prompt text
 * @returns {Promise<{rootCause: string, probability: number}|null>} - Root cause or null if failed
 */
async function callNIMForRootCause(model, prompt) {
    const modelName = model === PRIMARY_MODEL ? "Llama 3.1" : "Mistral";
    console.log(`🤖 [AI Analysis] Attempting root cause analysis with ${modelName}...`);
    
    try {
        const { data } = await axios.post(
            `${NIM_BASE_URL}/v1/chat/completions`,
            {
                model: model,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                temperature: 0.3,
                max_tokens: 200,
            },
            {
                headers: NIM_HEADERS,
                timeout: 20000, // 20 second timeout for more complex analysis
            }
        );

        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
            console.log(`❌ [AI Analysis] ${modelName} returned invalid response format`);
            return null;
        }

        const response = data.choices[0].message.content.trim();
        return response;
    } catch (error) {
        // Check for authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
            nimApiAvailable = false;
            console.log(`❌ [AI Analysis] ${modelName} - Authentication failed (${error.response?.status}). Disabling API calls.`);
        } else if (error.response?.status) {
            console.log(`❌ [AI Analysis] ${modelName} - API error (${error.response?.status}): ${error.message}`);
        } else {
            console.log(`❌ [AI Analysis] ${modelName} - Request failed: ${error.message}`);
        }
        // Return null to trigger fallback
        return null;
    }
}

/**
 * Analyze root cause using NVIDIA NIM API
 * Tries primary model first, then secondary, then fallback
 * Returns: { rootCause: string, rootCauseProbability: number }
 */
async function analyzeRootCause(incident, logs) {
    console.log("📊 [AI Analysis] Starting root cause analysis...");
    
    // Use fallback immediately if API is known to be unavailable
    if (!nimApiAvailable || !NIM_API_KEY) {
        console.log("⚠️ [AI Analysis] API unavailable, using rule-based fallback for root cause");
        return analyzeRootCauseFallback(incident, logs);
    }

    const errorLogs = logs.filter(l => l.level === "error");
    const warningLogs = logs.filter(l => l.level === "warning");
    
    // Prepare context for AI analysis
    const logMessages = logs.slice(0, 20).map(l => `[${l.level.toUpperCase()}] ${l.message}`).join("\n");
    const contextText = `
Incident Title: ${incident.title || "Unknown"}
Incident Description: ${incident.description || "No description"}
Severity: ${incident.severity || "unknown"}
Category: ${incident.category || "unknown"}
Total Logs: ${logs.length}
Error Logs: ${errorLogs.length}
Warning Logs: ${warningLogs.length}

Recent Log Entries:
${logMessages}
`.trim();

    // Truncate if too long
    const truncatedText = contextText.length > 2000 ? contextText.substring(0, 2000) + "..." : contextText;

    const prompt = `Analyze the following system incident and identify the most likely root cause. 
Provide a clear, concise explanation of what is causing the issue.

Format your response as:
ROOT_CAUSE: [Your root cause explanation here]

${truncatedText}

ROOT_CAUSE:`;

    // Try PRIMARY model first (Llama 3.1 - best for reasoning and analysis)
    console.log("🔵 [AI Analysis] Trying PRIMARY model: Llama 3.1 8B Instruct");
    let aiResponse = await callNIMForRootCause(PRIMARY_MODEL, prompt);
    if (aiResponse) {
        const rootCause = parseRootCauseResponse(aiResponse);
        if (rootCause) {
            console.log(`✅ [AI Analysis] Llama 3.1 successfully analyzed root cause`);
            return rootCause;
        }
    }

    // Try SECONDARY model (Mistral - backup)
    console.log("🟡 [AI Analysis] Primary model failed, trying SECONDARY model: Mistral 7B Instruct");
    aiResponse = await callNIMForRootCause(SECONDARY_MODEL, prompt);
    if (aiResponse) {
        const rootCause = parseRootCauseResponse(aiResponse);
        if (rootCause) {
            console.log(`✅ [AI Analysis] Mistral successfully analyzed root cause`);
            return rootCause;
        }
    }

    // Both models failed - use fallback
    console.log("🟠 [AI Analysis] Both AI models failed. Switching to rule-based pattern matching for root cause...");
    const fallbackResult = analyzeRootCauseFallback(incident, logs);
    console.log(`✅ [AI Analysis] Rule-based analysis identified root cause: ${fallbackResult.rootCause}`);
    
    return fallbackResult;
}

/**
 * Parse AI response to extract root cause
 * @param {string} response - AI model response
 * @returns {{rootCause: string, rootCauseProbability: number}|null}
 */
function parseRootCauseResponse(response) {
    try {
        // Try to extract ROOT_CAUSE: from response
        const rootCauseMatch = response.match(/ROOT_CAUSE:\s*(.+?)(?:\n|$)/i);
        if (rootCauseMatch && rootCauseMatch[1]) {
            const rootCause = rootCauseMatch[1].trim();
            // Estimate probability based on response quality (AI responses typically high confidence)
            const probability = rootCause.length > 50 ? 0.85 : 0.75;
            return { rootCause, rootCauseProbability: probability };
        }
        
        // If no ROOT_CAUSE: prefix, use first 300 chars as root cause
        const rootCause = response.trim().substring(0, 300);
        if (rootCause.length > 20) {
            return { rootCause, rootCauseProbability: 0.75 };
        }
        
        return null;
    } catch (error) {
        console.error("Error parsing root cause response:", error);
        return null;
    }
}

/**
 * Fallback root cause analysis using pattern matching
 */
function analyzeRootCauseFallback(incident, logs) {
    const errorLogs = logs.filter(l => l.level === "error");
    const warningLogs = logs.filter(l => l.level === "warning");
    
    let rootCause = "Unknown - Insufficient data to determine root cause";
    let probability = 0.5;

    // Pattern-based root cause detection
    const logText = logs.map(l => l.message.toLowerCase()).join(" ");
    
    if (logText.includes("timeout") || logText.includes("connection")) {
        rootCause = "Network/Connection timeout - Possible network instability or resource exhaustion";
        probability = 0.85;
    } else if (logText.includes("database") || logText.includes("db") || logText.includes("query")) {
        rootCause = "Database performance issue - Possible query optimization needed or connection pool exhaustion";
        probability = 0.80;
    } else if (logText.includes("cpu") || logText.includes("memory") || logText.includes("resource")) {
        rootCause = "Resource exhaustion - CPU or memory limits reached";
        probability = 0.75;
    } else if (logText.includes("auth") || logText.includes("authentication") || logText.includes("login")) {
        rootCause = "Authentication system failure - Possible credential issues or service outage";
        probability = 0.70;
    } else if (errorLogs.length > warningLogs.length * 2) {
        rootCause = "Cascading failures - Multiple error patterns detected";
        probability = 0.65;
    }

    return { rootCause, rootCauseProbability: probability };
}

module.exports = { analyzeSeverity, analyzeCategory, analyzeRootCause };
