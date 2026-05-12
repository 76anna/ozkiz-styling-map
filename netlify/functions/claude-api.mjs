// netlify/functions/claude-api.mjs

function reply(data, status) {
  var body = new TextEncoder().encode(JSON.stringify(data));
  return new Response(body, {
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

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return reply({ error: "API key not configured" }, 500);
  }

  var raw;
  try {
    raw = await request.text();
  } catch (e) {
    return reply({ error: "Cannot read body" }, 400);
  }

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return reply({ error: "Invalid JSON" }, 400);
  }

  var messages = parsed.messages;
  var maxTokens = parsed.maxTokens || 1000;

  if (!messages || !Array.isArray(messages)) {
    return reply({ error: "Invalid format" }, 400);
  }

  try {
    var apiBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: Math.min(maxTokens, 4096),
      messages: messages
    });

    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: new TextEncoder().encode(apiBody)
    });

    if (!res.ok) {
      var errText = await res.text();
      console.error("API error", res.status, errText);
      return reply({ error: "API error " + res.status }, res.status);
    }

    var data = await res.json();
    var txt = "";
    for (var i = 0; i < data.content.length; i++) {
      txt += data.content[i].text || "";
    }
    var cleaned = txt.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      return reply(JSON.parse(cleaned));
    } catch (e) {
      return reply({ rawText: cleaned });
    }
  } catch (err) {
    console.error("Error:", err.message);
    return reply({ error: "Server error" }, 500);
  }
};

export const config = {
  path: "/.netlify/functions/claude-api"
};
