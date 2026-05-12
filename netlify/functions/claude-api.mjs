// netlify/functions/claude-api.mjs

function reply(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method !== "POST") {
    return reply({ error: "POST only" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return reply({ error: "API key not configured" }, 500);
  }

  let body;
  try {
    const raw = await request.text();
    body = JSON.parse(raw);
  } catch (e) {
    return reply({ error: "Invalid JSON body" }, 400);
  }

  const { messages, maxTokens } = body;
  if (!messages || !Array.isArray(messages)) {
    return reply({ error: "Invalid request format" }, 400);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: Math.min(maxTokens || 1000, 4096),
        messages: messages
      })
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("API error", res.status, t);
      return reply({ error: "API error " + res.status }, res.status);
    }

    const data = await res.json();
    const txt = data.content.map(function(c) { return c.text || ""; }).join("");
    const cleaned = txt.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      return reply(JSON.parse(cleaned));
    } catch (e) {
      return reply({ rawText: cleaned });
    }
  } catch (err) {
    console.error("Error:", err.message);
    return reply({ error: "Server error: " + err.message }, 500);
  }
};

export const config = {
  path: "/.netlify/functions/claude-api"
};
