// Cloudflare Worker: Nirala Doubt Solver backend
// Secrets (Cloudflare dashboard mein set karo, code mein KABHI mat likhna):
//   ANTHROPIC_API_KEY  = tumhari Claude API key
// Variables:
//   ALLOWED_ORIGIN     = https://nirala-english-wala.github.io  (apni site ka address)

const MODEL = "claude-haiku-5-5"; // sasta aur tez model
const MAX_TOKENS = 700;
const MAX_HISTORY = 10;   // sirf pichle 10 messages bhejte hain
const MAX_CHARS = 1500;   // ek message ki max length

const SYSTEM_PROMPT = `You are "Nirala Doubt Solver", a friendly tutor for students of Nirala English Wala & Arts Classes in Bihar, India.
- Reply in simple Hinglish (Hindi written in Roman letters mixed with easy English), unless the student writes in pure English or Hindi.
- Explain step by step, in short paragraphs, with one small example when helpful.
- Subjects: English (grammar, writing, comprehension) and Arts subjects (History, Political Science, Geography, Hindi, etc.), following BSEB / Bihar Board syllabus style.
- If you are not sure about a fact, say so instead of guessing.
- If a question is not about studies, politely bring the student back to their studies.
- Keep answers under about 150 words unless the student asks for more detail.
- End with one short question or tip to check if the student understood.`;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const headers = { ...cors(origin), "Content-Type": "application/json" };

    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST")
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers });

    // Sirf tumhari site se aayi request allow karo
    const reqOrigin = request.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && reqOrigin !== env.ALLOWED_ORIGIN)
      return new Response(JSON.stringify({ error: "Not allowed" }), { status: 403, headers });

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers }); }

    const subject = String(body.subject || "General").slice(0, 40);
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    if (!messages.length || messages[messages.length - 1].role !== "user")
      return new Response(JSON.stringify({ error: "Empty question" }), { status: 400, headers });

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: `${SYSTEM_PROMPT}\nCurrent subject chosen by student: ${subject}.`,
        messages,
      }),
    });

    if (!apiRes.ok) {
      return new Response(JSON.stringify({ error: "AI abhi available nahi hai, thodi der baad try karo." }),
        { status: 502, headers });
    }

    const data = await apiRes.json();
    const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return new Response(JSON.stringify({ reply }), { headers });
  },
};
