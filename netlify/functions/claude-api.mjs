export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "API key not set" }) };
  }

  var parsed;
  try {
    var raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
    parsed = JSON.parse(raw);
  } catch (e) {
    return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  var messages = parsed.messages;
  var maxTokens = parsed.maxTokens || 1000;

  try {
    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: Math.min(maxTokens, 4096), messages: messages })
    });

    if (!res.ok) {
      console.error("API error", res.status);
      return { statusCode: res.status, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "API error " + res.status }) };
    }

    var data = await res.json();
    var txt = "";
    for (var i = 0; i < data.content.length; i++) {
      txt += data.content[i].text || "";
    }
    var cleaned = txt.replace(/```json/g, "").replace(/```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
      body: cleaned
    };
  } catch (err) {
    console.error("Error:", err.message);
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Server error" }) };
  }
}
