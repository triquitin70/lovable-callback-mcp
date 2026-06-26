# lovable-callback-mcp

Remote MCP server for sending final execution callbacks to Lovable.

## Features

- Node.js + TypeScript
- Remote MCP over HTTP
- Railway-ready
- `GET /health`
- `POST /mcp`
- Single MCP tool: `send_callback`
- Input validation with Zod
- HTTPS POST to `LOVABLE_CALLBACK_URL`
- Required callback header: `X-Milton-Secret`
- Configurable timeout with environment variables

## Project structure

```text
.
â”œâ”€ package.json
â”œâ”€ tsconfig.json
â”œâ”€ railway.json
â”œâ”€ .env.example
â”œâ”€ src/
â”‚  â”œâ”€ index.ts
â”‚  â”œâ”€ config.ts
â”‚  â”œâ”€ tools/
â”‚  â”‚  â””â”€ sendCallback.ts
â”‚  â””â”€ lib/
â”‚     â”œâ”€ http.ts
â”‚     â””â”€ validation.ts
â””â”€ README.md
Environment variables
Copy .env.example to .env and set values:

PORT=8080
LOVABLE_CALLBACK_URL=https://project--6d4587a1-ab71-492b-928b-9c7c20facde6.lovable.app/api/public/milton/test
CALLBACK_TIMEOUT_MS=10000
CALLBACK_SOURCE=miltonmail
MILTON_CALLBACK_SECRET=tu-secreto-compartido
Install
npm install
Build
npm run build
Start
npm run start
Dev
npm run dev
Endpoints
Health
GET /health
Response:

{
  "ok": true,
  "service": "lovable-callback-mcp"
}
MCP
POST /mcp
Use this as the public Custom MCP URL after deploy:

https://your-service.up.railway.app/mcp
MCP tool
send_callback
Input schema:

{
  "type": "object",
  "additionalProperties": false,
  "required": ["execution_id", "status", "message"],
  "properties": {
    "execution_id": {
      "type": "string",
      "minLength": 1
    },
    "status": {
      "type": "string",
      "enum": ["completed", "error"]
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    },
    "result_payload": {
      "type": "object"
    },
    "error_code": {
      "type": ["string", "null"],
      "maxLength": 100
    }
  }
}
Payload sent to Lovable
For input:

{
  "execution_id": "test-001",
  "status": "completed",
  "message": "Proceso finalizado",
  "result_payload": {},
  "error_code": null
}
This server sends:

{
  "execution_id": "test-001",
  "status": "completed",
  "message": "Proceso finalizado",
  "error_code": null,
  "source": "miltonmail",
  "event_type": "execution.completed",
  "result_payload": {}
}
And it also sends this required header on every callback request:

X-Milton-Secret: <MILTON_CALLBACK_SECRET>
Success response
{
  "ok": true,
  "delivery_status": "sent",
  "execution_id": "test-001",
  "target": "lovable_callback",
  "http_status": 200,
  "message": "Callback delivered successfully",
  "error_code": null
}
Error response
{
  "ok": false,
  "delivery_status": "failed",
  "execution_id": "test-001",
  "target": "lovable_callback",
  "http_status": 500,
  "message": "Callback delivery failed",
  "error_code": "callback_request_failed"
}
Error codes
Validation:

missing_execution_id

missing_status

missing_message

invalid_status

invalid_result_payload

invalid_input

Transport:

callback_timeout

callback_connection_failed

HTTP:

callback_http_4xx

callback_http_5xx

Generic:

callback_request_failed
