// api/blog.js — 네이버 인기 검색어(질문/문장형 포함)를 바탕으로 블로그 글을 생성한다.
// POST { topic, keywords, tone, length } -> { post }

const MODEL = "claude-sonnet-4-6";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용됩니다." });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  async function callAnthropic(messages, maxTokens) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Anthropic ${r.status}: ${t}`);
    }
    const data = await r.json();
    return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n").trim();
  }

  try {
    const topic = body.topic || "방문재활, 재활운동";
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    const tone = body.tone || "따뜻하고 친근하게";
    const length = (body.length || "보통").toString();
    const lenHint = length.includes("짧") ? "600~800자" : length.includes("길") ? "1300자 이상" : "900~1100자";

    const promptText = `너는 방문재활·재활운동 분야의 전문 블로그 작가야.
아래는 네이버에서 사람들이 실제로 많이 검색한 검색어(질문·문장형 포함)야. 이 검색어들이 다루는 궁금증이 글 속에서 자연스럽게 풀리도록, 네이버 블로그에 바로 올릴 한국어 글을 써줘.

[주제]
${topic}

[실제 인기 검색어 (인기순)]
${keywords.map((k, i) => `${i + 1}. ${k.keyword || k}`).join("\n")}

[작성 규칙]
- 말투: ${tone}
- 분량: ${lenHint}
- 맨 앞에 매력적인 제목 1개 (# 으로 시작)
- 소제목(##) 2~3개로 구성
- 위 검색어들이 묻는 질문에 실제로 답이 되도록 본문에서 풀어줄 것 (키워드를 억지로 나열하지 말고 자연스럽게)
- 의학적 효과를 단정·과장하지 말 것. 증상이 있으면 전문가(의사·물리치료사) 상담을 권하는 문장을 자연스럽게 포함
- 이미지나 사진 표시는 넣지 말 것. 마크다운 텍스트만 출력 (다른 머리말 없이 글만)`;

    const post = await callAnthropic([{ role: "user", content: promptText }], 2000);
    return res.status(200).json({ post });
  } catch (e) {
    return res.status(500).json({ error: "생성 중 오류가 발생했습니다.", detail: String(e.message || e) });
  }
};
