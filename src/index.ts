import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
CallToolRequestSchema,
ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { sendCallback } from "./tools/sendCallback.js";

function createMcpServer() {
const server = new Server(
{
name: "lovable-callback-mcp",
version: "1.0.0"
},
{
capabilities: {
tools: {}
}
}
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
return {
tools: [
{
name: "send_callback",
description:
"Send a final execution callback to a fixed Lovable HTTPS endpoint.",
inputSchema: {
type: "object",
additionalProperties: false,
required: ["execution_id", "status", "message"],
properties: {
execution_id: {
type: "string",
minLength: 1
},
status: {
type: "string",
enum: ["completed", "error"]
},
message: {
type: "string",
minLength: 1,
maxLength: 500
},
result_payload: {
type: "object"
},
error_code: {
type: ["string", "null"],
maxLength: 100
}
}
}
}
]
};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
if (request.params.name !== "send_callback") {
return {
content: [
{
type: "text",
text: JSON.stringify({
ok: false,
delivery_status: "failed",
execution_id: "",
target: "lovable_callback",
http_status: 0,
message: "Callback delivery failed",
error_code: "invalid_input"
})
}
],
isError: true
};
}

const result = await sendCallback(request.params.arguments ?? {});

return {
  content: [
    {
      type: "text",
      text: JSON.stringify(result)
    }
  ],
  isError: !result.ok
};
});

return server;
}

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
res.status(200).json({
ok: true,
service: "lovable-callback-mcp"
});
});

app.all("/mcp", async (req, res) => {
try {
const server = createMcpServer();

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined
});

res.on("close", () => {
  transport.close().catch(() => undefined);
  server.close().catch(() => undefined);
});

await server.connect(transport);
await transport.handleRequest(req, res, req.body);
} catch (error) {
console.error("MCP request failed:", error);

if (!res.headersSent) {
  res.status(500).json({
    ok: false,
    message: "Internal MCP server error"
  });
}
}
});

app.listen(config.PORT, () => {
console.log(
`lovable-callback-mcp listening on port ${config.PORT} - MCP endpoint: /mcp`
);
});
