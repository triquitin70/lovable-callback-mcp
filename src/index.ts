import { randomUUID } from "crypto";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "./config.js";
import { sendCallback } from "./tools/sendCallback.js";

type SessionEntry = {
  server: Server;
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, SessionEntry>();

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

function createSessionEntry(): SessionEntry {
  const server = createMcpServer();

  let transport!: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
    }
  });

  return { server, transport };
}

async function closeSession(sessionId: string) {
  const entry = sessions.get(sessionId);

  if (!entry) {
    return false;
  }

  sessions.delete(sessionId);
  await entry.transport.close().catch(() => undefined);
  await entry.server.close().catch(() => undefined);
  return true;
}

function getSessionId(req: express.Request) {
  const value = req.header("mcp-session-id");
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getSessionEntry(req: express.Request) {
  const sessionId = getSessionId(req);
  return sessionId ? sessions.get(sessionId) ?? null : null;
}

function getRequestId(body: unknown) {
  return typeof body === "object" && body !== null && "id" in body
    ? (body as Record<string, unknown>).id
    : null;
}

function isInitializeRequest(body: unknown) {
  return (
    typeof body === "object" &&
    body !== null &&
    "method" in body &&
    (body as Record<string, unknown>).method === "initialize"
  );
}

async function handleMcpRequest(req: express.Request, res: express.Response) {
  try {
    let entry = getSessionEntry(req);

    if (!entry) {
      if (req.method !== "POST") {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Missing MCP session. Start with POST initialize or use the session id returned by the server."
          },
          id: null
        });
        return;
      }

      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "The first MCP request must be initialize."
          },
          id: getRequestId(req.body)
        });
        return;
      }

      entry = createSessionEntry();
      await entry.server.connect(entry.transport);
    }

    await entry.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        message: "Internal MCP server error"
      });
    }
  }
}

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "lovable-callback-mcp",
    transport: "streamable-http",
    mcp_paths: ["/mcp", "/"]
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "lovable-callback-mcp",
    transport: "streamable-http",
    recommended_mcp_url: "/mcp",
    alternate_mcp_url: "/"
  });
});

app.delete(["/mcp", "/"], async (req, res) => {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    res.status(400).json({
      ok: false,
      message: "Missing MCP session id"
    });
    return;
  }

  const closed = await closeSession(sessionId);

  if (!closed) {
    res.status(404).json({
      ok: false,
      message: "Unknown MCP session id"
    });
    return;
  }

  res.status(204).end();
});

app.all(["/mcp", "/"], async (req, res, next) => {
  if (req.path === "/" && req.method === "GET") {
    next();
    return;
  }

  if (req.method === "DELETE") {
    next();
    return;
  }

  await handleMcpRequest(req, res);
});

app.listen(config.PORT, () => {
  console.log(
    `lovable-callback-mcp listening on port ${config.PORT} - MCP endpoints: /mcp and /`
  );
});