// netlify/functions/claude-api.mjs
// Netlify Serverless Function: Claude API 프록시
// API 키를 서버에서만 사용 — 브라우저에 노출 안 됨

export default async (request) => {
  // ---- CORS: 같은 사이트에서만 허용 ----
  const origin = request.headers.get("origin") || "";
  const siteUrl = process.env.URL || ""; // Netlify가 자동 설정하는 사이트 URL

  const allowedOrigins = [siteUrl, "http://localhost:5173", "http://localhost:3000"];
  const isAllowed = allowedOrigins.some(o => o && origin.startsWith(o));

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "POST만 허용됩니다" }, { status: 405, headers: corsHeaders });
  }

  if (!isAllowed) {
    return Response.json({ error: "허용되지 않은 출처입니다" }, { status: 403, headers: corsHeaders });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다. Netlify 환경변수를 확인하세요." },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const bodyText = await request.text();
    if (bodyText.length > 10 * 1024 * 1024) {
      return Response.json(
        { error: "요청이 너무 큽니다. 이미지를 줄여주세요." },
        { status: 413, headers: corsHeaders }
      );
    }

    const { messages, maxTokens = 1000 } = JSON.parse(bodyText);

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "잘못된 요청 형식입니다" },
        { status: 400, headers: corsHeaders }
      );
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
      const userMsg = res.status === 401
        ? "API 키가 유효하지 않습니다. 관리자에게 문의하세요."
        : res.status === 429
        ? "요청이 너무 많습니다. 잠시 후 다시 시도하세요."
        : `AI 분석 오류 (${res.status})`;
      return Response.json({ error: userMsg }, { status: res.status, headers: corsHeaders });
    }

    const data = await res.json();
    const textContent = data.content.map((c) => c.text || "").join("");
    const cleaned = textContent.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ rawText: cleaned }, { headers: corsHeaders });
    }

    return Response.json(parsed, { headers: corsHeaders });
  } catch (err) {
    console.error("Function error:", err);
    return Response.json(
      { error: "서버 내부 오류가 발생했습니다" },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config = {
  path: "/.netlify/functions/claude-api",
};
