// netlify/functions/claude-api.mjs

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not set" }, 500);
  }

  try {
    const body = await request.json();
    const { messages, maxTokens = 1000 } = body;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: "Invalid request" }, 400);
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: Math.min(maxTokens, 4096),
        messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Claude API error:", res.status, errBody);
      const msg = res.status === 401
        ? "API key invalid"
        : res.status === 429
        ? "Rate limited"
        : "API error " + res.status;
      return jsonResponse({ error: msg }, res.status);
    }

    const data = await res.json();
    const textContent = data.content.map((c) => c.text || "").join("");
    const cleaned = textContent.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return jsonResponse({ rawText: cleaned });
    }

    return jsonResponse(parsed);

  } catch (err) {
    console.error("Function error:", err.message);
    return jsonResponse({ error: err.message || "Server error" }, 500);
  }
};

export const config = {
  path: "/.netlify/functions/claude-api",
};
