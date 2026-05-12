async function callClaude(messages, maxTokens = 1000) {
  const res = await fetch("/.netlify/functions/claude-api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, maxTokens })
  });
  if (!res.ok) {
    let msg = "API " + res.status;
    try { var e = await res.json(); msg = e.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return await res.json();
}
