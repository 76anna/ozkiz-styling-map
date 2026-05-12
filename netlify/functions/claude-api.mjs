// netlify/functions/claude-api.mjs

export default async (request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "POST만 허용됩니다" }, { status: 405, headers: corsHeaders });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    return Response.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다" },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { messages, maxTokens = 1000 } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "잘못된 요청 형식입니다" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("Calling Claude API, messages count:", messages.length);

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
        : res.status === 413
        ? "이미지가 너무 큽니다. 제품 수를 줄여주세요."
        : `AI 분석 오류 (${res.status})`;
      return Response.json({ error: userMsg }, { status: res.status, headers: corsHeaders });
    }

    const data = await res.json();
    console.log("Claude API success, content blocks:", data.content?.length);

    const textContent = data.content.map((c) => c.text || "").join("");
    const cleaned = textContent.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.log("Could not parse JSON, returning raw text");
      return Response.json({ rawText: cleaned }, { headers: corsHeaders });
    }

    return Response.json(parsed, { headers: corsHeaders });

  } catch (err) {
    console.error("Function error:", err.message, err.stack);
    return Response.json(
      { error: "서버 오류: " + (err.message || "알 수 없는 오류") },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config = {
  path: "/.netlify/functions/claude-api",
};
