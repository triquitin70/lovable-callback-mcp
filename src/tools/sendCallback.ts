import { config } from "../config.js";
import { postJson } from "../lib/http.js";
import {
validateSendCallbackInput,
type SendCallbackInput
} from "../lib/validation.js";

type CallbackResult = {
ok: boolean;
delivery_status: "sent" | "failed";
execution_id: string;
target: "lovable_callback";
http_status: number;
message: string;
error_code:
| null
| "missing_execution_id"
| "missing_status"
| "missing_message"
| "invalid_status"
| "invalid_result_payload"
| "invalid_input"
| "callback_timeout"
| "callback_connection_failed"
| "callback_http_4xx"
| "callback_http_5xx"
| "callback_request_failed";
};

function buildLovablePayload(input: SendCallbackInput) {
return {
execution_id: input.execution_id,
status: input.status,
message: input.message,
error_code: input.error_code ?? null,
source: config.CALLBACK_SOURCE,
event_type:
input.status === "completed"
? "execution.completed"
: "execution.error",
result_payload: input.result_payload ?? {}
};
}

function getValidationErrorCode(
rawInput: unknown
):
| "missing_execution_id"
| "missing_status"
| "missing_message"
| "invalid_status"
| "invalid_result_payload"
| "invalid_input" {
if (typeof rawInput !== "object" || rawInput === null) {
return "invalid_input";
}

const input = rawInput as Record<string, unknown>;

if (!("execution_id" in input) || input.execution_id === "") {
return "missing_execution_id";
}

if (!("status" in input)) {
return "missing_status";
}

if (input.status !== "completed" && input.status !== "error") {
return "invalid_status";
}

if (!("message" in input) || input.message === "") {
return "missing_message";
}

if (
"result_payload" in input &&
(typeof input.result_payload !== "object" || input.result_payload === null)
) {
return "invalid_result_payload";
}

return "invalid_input";
}

export async function sendCallback(rawInput: unknown): Promise<CallbackResult> {
const parsed = validateSendCallbackInput(rawInput);

if (!parsed.success) {
const executionId =
typeof rawInput === "object" &&
rawInput !== null &&
"execution_id" in rawInput &&
typeof (rawInput as Record<string, unknown>).execution_id === "string"
? ((rawInput as Record<string, unknown>).execution_id as string)
: "";

return {
  ok: false,
  delivery_status: "failed",
  execution_id: executionId,
  target: "lovable_callback",
  http_status: 0,
  message: "Callback delivery failed",
  error_code: getValidationErrorCode(rawInput)
};
}

const input = parsed.data;
const payload = buildLovablePayload(input);

const result = await postJson(
config.LOVABLE_CALLBACK_URL,
payload,
config.CALLBACK_TIMEOUT_MS,
config.MILTON_CALLBACK_SECRET
);

if (result.ok) {
return {
ok: true,
delivery_status: "sent",
execution_id: input.execution_id,
target: "lovable_callback",
http_status: result.status,
message: "Callback delivered successfully",
error_code: null
};
}

return {
ok: false,
delivery_status: "failed",
execution_id: input.execution_id,
target: "lovable_callback",
http_status: result.status,
message: "Callback delivery failed",
error_code: result.errorCode
};
}
