// api/blog.js — 인기 검색어 + 센터 정보로 블로그 글 생성.
// fresh=true 이면 웹 검색으로 최신 뉴스·정책을 반영해 매번 갱신된 글을 쓴다.
// POST { topic, keywords, tone, length, center, fresh, date } -> { post }

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

  async function callAnthropic(messages, maxTokens, tools) {
    const payload = { model: MODEL, max_tokens: maxTokens, messages };
    if (tools) payload.tools = tools;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
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
    const c = body.center || {};
    const fresh = !!body.fresh;
    const dateStr = (body.date || "").toString();
    const lenHint = length.includes("짧") ? "600~800자" : length.includes("길") ? "1300자 이상" : "900~1100자";

    const centerBlock = (c.name && c.name.trim()) ? `
[우리 센터 정보 — 글에 자연스럽게 녹일 것]
- 센터명: ${c.name}
- 지역/지점: ${c.area || ""}
- 전화: ${c.phone || ""}
- 강점: ${c.strength || ""}
- 한줄 소개(철학): ${c.slogan || ""}

[센터 반영 규칙]
- 위 센터를 글 속에 자연스럽게 1~2회만 언급 (광고처럼 도배하지 말 것)
- 글의 마지막 부분에서, 무료 첫 방문 평가·상담과 전화번호로 부드럽게 안내
- 한줄 소개의 철학을 글의 톤에 은은하게 반영
- 본문은 검색어 질문에 답이 되는 '정보 글'이 중심, 센터 홍보는 그 위에 자연스럽게 얹는 정도` : `
[센터 정보 없음]
- 특정 센터 홍보 없이 정보 글만 작성`;

    const freshBlock = fresh ? `
[시의성 — 매달 갱신되는 글]
- 이 글은 같은 주제로 매달 다시 작성될 수 있어. 오늘 날짜(${dateStr || "현재"})를 기준으로, '${topic}' 관련 **최근 뉴스·정책·연구·소식**을 웹에서 찾아 한두 가지 자연스럽게 본문에 녹여서, 지난달과는 다른 시의성 있는 글로 써줘.
- 웹 검색으로 확인된 사실만 반영하고, 날짜·수치·출처를 지어내지 말 것. 확실치 않으면 일반 정보로 작성.
- 뉴스 내용은 짧게 인용·요약만 (원문 길게 베끼지 말 것).` : "";

    const promptText = `너는 방문재활·재활운동 분야의 전문 블로그 작가야.
아래는 네이버에서 사람들이 실제로 많이 검색한 검색어(질문·문장형 포함)야. 이 검색어들이 다루는 궁금증이 글 속에서 자연스럽게 풀리도록, 네이버 블로그에 바로 올릴 한국어 글을 써줘.

[주제]
${topic}

[실제 인기 검색어 (인기순)]
${keywords.map((k, i) => `${i + 1}. ${k.keyword || k}`).join("\n")}
${centerBlock}
${freshBlock}

[작성 규칙]
- 말투: ${tone}
- 분량: ${lenHint}
- 맨 앞에 매력적인 제목 1개 (# 으로 시작)
- 소제목(##) 2~3개로 구성
- 위 검색어들이 묻는 질문에 실제로 답이 되도록 본문에서 풀어줄 것 (키워드를 억지로 나열하지 말고 자연스럽게)
- 의학적 효과를 단정·과장하지 말 것. 증상이 있으면 전문가(의사·물리치료사) 상담을 권하는 문장을 자연스럽게 포함
- 이미지나 사진 표시는 넣지 말 것. 마크다운 텍스트만 출력 (다른 머리말 없이 글만)`;

    let post;
    if (fresh) {
      const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
      try {
        post = await callAnthropic([{ role: "user", content: promptText }], 3500, tools);
      } catch (e) {
        // 웹 검색이 막혀 있으면 검색 없이라도 글은 작성
        post = await callAnthropic([{ role: "user", content: promptText }], 2500, null);
      }
    } else {
      post = await callAnthropic([{ role: "user", content: promptText }], 2000, null);
    }
    return res.status(200).json({ post });
  } catch (e) {
    return res.status(500).json({ error: "생성 중 오류가 발생했습니다.", detail: String(e.message || e) });
  }
};
