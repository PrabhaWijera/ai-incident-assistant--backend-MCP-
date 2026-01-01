const tools = require("./tools");

const runAgent = async ({ action, payload }) => {
    try {
        if (!action) {
            throw new Error("Action is required");
        }

        if (!tools[action]) {
            throw new Error(`Tool '${action}' not allowed. Available tools: ${Object.keys(tools).join(", ")}`);
        }

        if (!payload) {
            throw new Error("Payload is required");
        }

        return await tools[action](payload);
    } catch (error) {
        throw new Error(`Agent execution failed: ${error.message}`);
    }
};

module.exports = runAgent;
