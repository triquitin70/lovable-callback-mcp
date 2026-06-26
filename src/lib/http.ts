export type HttpPostJsonResult =
| {
ok: true;
status: number;
bodyText: string;
}
| {
ok: false;
status: number;
errorCode:
| "callback_timeout"
| "callback_connection_failed"
| "callback_http_4xx"
| "callback_http_5xx"
| "callback_request_failed";
bodyText?: string;
};

export async function postJson(
url: string,
body: unknown,
timeoutMs: number,
secret: string
): Promise<HttpPostJsonResult> {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
const response = await fetch(url, {
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Milton-Secret": secret
},
body: JSON.stringify(body),
signal: controller.signal
});

const bodyText = await response.text();

if (response.ok) {
  return {
    ok: true,
    status: response.status,
    bodyText
  };
}

if (response.status >= 400 && response.status < 500) {
  return {
    ok: false,
    status: response.status,
    errorCode: "callback_http_4xx",
    bodyText
  };
}

if (response.status >= 500) {
  return {
    ok: false,
    status: response.status,
    errorCode: "callback_http_5xx",
    bodyText
  };
}

return {
  ok: false,
  status: response.status,
  errorCode: "callback_request_failed",
  bodyText
};
} catch (error) {
if (error instanceof Error && error.name === "AbortError") {
return {
ok: false,
status: 0,
errorCode: "callback_timeout"
};
}

return {
  ok: false,
  status: 0,
  errorCode: "callback_connection_failed"
};
} finally {
clearTimeout(timeout);
}
}
