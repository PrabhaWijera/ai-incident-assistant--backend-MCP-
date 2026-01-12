const express = require("express");
const tools = require("../ai/tools");
const { analyzeIncidentReadOnly } = require("../services/aiAnalysis.service");

const router = express.Router();

/**
 * MCP Server Metadata
 * 
 * Exposes server information via the server/info JSON-RPC method.
 * This follows the Model Context Protocol (MCP) specification for tool discovery.
 */
const MCP_SERVER_INFO = {
    name: "ai-incident-mcp",
    version: "1.0.0",
    protocol: "mcp-jsonrpc-2.0",
    transport: "http-jsonrpc",
    description: "Educational MCP-style JSON-RPC server exposing read-only incident tools",
};

/**
 * MCP Tool Registry (READ-ONLY Operations Only)
 * 
 * All tools exposed via MCP are strictly read-only to follow security best practices.
 * This ensures AI agents can analyze incidents but cannot modify system state.
 * 
 * Architecture:
 * - Tools defined as array for maintainability
 * - Converted to lookup map for O(1) validation during tool calls
 */
const TOOL_DEFINITIONS = [
    {
        name: "getIncidentById",
        description: "Fetch a single incident by its MongoDB ID",
        inputSchema: {
            type: "object",
            properties: {
                id: { type: "string", description: "Incident MongoDB ObjectId" },
            },
            required: ["id"],
            additionalProperties: false,
        },
        implementation: async (args) => tools.getIncidentById(args),
    },
    {
        name: "getLogsByIncident",
        description: "Fetch logs associated with a specific incident",
        inputSchema: {
            type: "object",
            properties: {
                incidentId: { type: "string", description: "Incident MongoDB ObjectId" },
            },
            required: ["incidentId"],
            additionalProperties: false,
        },
        implementation: async (args) => tools.getLogsByIncident(args),
    },
    {
        name: "analyzeIncident",
        description: "Run READ-ONLY NVIDIA NIM AI analysis on an incident and its logs. Returns analysis results without modifying database state.",
        inputSchema: {
            type: "object",
            properties: {
                incidentId: { type: "string", description: "Incident MongoDB ObjectId" },
            },
            required: ["incidentId"],
            additionalProperties: false,
        },
        implementation: async (args) => analyzeIncidentReadOnly(args.incidentId),
    },
];

const MCP_TOOLS = TOOL_DEFINITIONS.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
}, {});

/**
 * Format response payload as MCP JSON content
 * 
 * MCP protocol requires responses to be wrapped in a content array
 * with type and data fields for consistent client parsing.
 */
function wrapJsonContent(payload) {
    return {
        content: [
            {
                type: "json",
                data: payload,
            },
        ],
    };
}

/**
 * Validate tool arguments against schema
 * 
 * Ensures required parameters are present before executing tool.
 * Throws descriptive errors for invalid input to aid debugging.
 */
function validateArgsOrThrow(tool, args) {
    const required = tool.inputSchema?.required || [];

    if (!args || typeof args !== "object") {
        throw new Error(`Invalid arguments for tool '${tool.name}' (expected object)`);
    }

    const missing = required.filter((key) => !(key in args));
    if (missing.length > 0) {
        throw new Error(
            `Missing required argument(s) for tool '${tool.name}': ${missing.join(", ")}`
        );
    }
}

/**
 * Format JSON-RPC error response
 * 
 * Follows JSON-RPC 2.0 error specification with standard error codes:
 * - -32600: Invalid Request
 * - -32601: Method not found
 * - -32602: Invalid params
 * - -32603: Internal error
 */
function jsonRpcError(id, code, message, data) {
    return {
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
            code,
            message,
            ...(data ? { data } : {}),
        },
    };
}

/**
 * MCP JSON-RPC Endpoint
 * 
 * POST /api/mcp/jsonrpc
 * 
 * Implements Model Context Protocol (MCP) JSON-RPC 2.0 interface.
 * All tools are READ-ONLY to prevent AI agents from modifying system state.
 * 
 * Supported methods:
 * - server/info: Returns server metadata and capabilities
 * - tools/list: Lists all available read-only tools
 * - tools/call: Executes a specific tool (read-only operations only)
 */
router.post("/jsonrpc", async (req, res) => {
    const { jsonrpc, id, method, params } = req.body || {};

    if (jsonrpc !== "2.0") {
        return res.status(400).json(
            jsonRpcError(id, -32600, "Invalid JSON-RPC version (expected '2.0')")
        );
    }

    try {
        if (method === "server/info") {
            return res.json({
                jsonrpc: "2.0",
                id,
                result: {
                    ...MCP_SERVER_INFO,
                    toolCount: TOOL_DEFINITIONS.length,
                },
            });
        }

        if (method === "tools/list") {
            // Return all available tools with explicit read-only safety level
            // This helps clients understand that no write operations are available
            const toolsList = TOOL_DEFINITIONS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                safetyLevel: "read-only", // Explicitly mark all tools as read-only
            }));

            return res.json({
                jsonrpc: "2.0",
                id,
                result: {
                    tools: toolsList,
                },
            });
        }

        if (method === "tools/call") {
            // Execute a read-only tool
            // All tools in MCP_TOOLS are guaranteed to be read-only (no database mutations)
            const { name, arguments: args } = params || {};

            if (!name || typeof name !== "string") {
                return res
                    .status(400)
                    .json(jsonRpcError(id, -32602, "Tool name must be a non-empty string"));
            }

            const tool = MCP_TOOLS[name];
            if (!tool) {
                return res
                    .status(400)
                    .json(
                        jsonRpcError(
                            id,
                            -32601,
                            `Unknown tool '${name}'`,
                            Object.keys(MCP_TOOLS)
                        )
                    );
            }

            // Validate arguments before execution
            validateArgsOrThrow(tool, args);

            // Execute tool implementation (all are read-only)
            const resultData = await tool.implementation(args);

            return res.json({
                jsonrpc: "2.0",
                id,
                result: wrapJsonContent(resultData),
            });
        }

        // Method not supported
        return res
            .status(400)
            .json(
                jsonRpcError(
                    id,
                    -32601,
                    `Unsupported method '${method}'. Use 'server/info', 'tools/list' or 'tools/call'.`
                )
            );
    } catch (error) {
        console.error("[MCP] Request failed:", error);
        return res
            .status(500)
            .json(
                jsonRpcError(
                    id,
                    -32603,
                    "Internal MCP server error",
                    process.env.NODE_ENV === "production" ? undefined : error.message
                )
            );
    }
});

module.exports = router;

