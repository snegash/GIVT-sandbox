// server/anthropic.js — forwards Messages API requests with the server key.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function callAnthropic(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const payload = {
    model: body.model || "claude-sonnet-4-20250514",
    max_tokens: body.max_tokens || 1024,
    messages: body.messages || [],
  };
  if (body.system) payload.system = body.system;
  if (body.tools) payload.tools = body.tools;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, data: await res.json() };
}
