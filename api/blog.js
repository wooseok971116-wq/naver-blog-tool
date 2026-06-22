// api/blog.js — 인기 검색어 + 센터 정보로 "네이버 블로그 지수에 강한" 예쁜 글 생성.
// fresh=true 이면 웹 검색으로 최신 뉴스·정책을 반영.
// POST { topic, keywords, tone, length, center, fresh, date } -> { post }

const MODEL = "claude-sonnet-4-6";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용됩니다." });
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요." });

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
    if (!r.ok) { const t = await r.text(); throw new Error(`Anthropic ${r.status}: ${t}`); }
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
    const ref = !!body.ref;
    const dateStr = (body.date || "").toString();
    const lenHint = length.includes("짧") ? "900자 내외" : length.includes("길") ? "1800자 이상" : "1200~1500자";

    const centerBlock = (c.name && c.name.trim()) ? `
[우리 센터 정보 — 글에 자연스럽게 녹일 것]
- 센터명: ${c.name}
- 지역/지점: ${c.area || ""}
- 전화: ${c.phone || ""}
- 강점: ${c.strength || ""}
- 한줄 소개(철학): ${c.slogan || ""}` : `
[센터 정보 없음 — 특정 센터 홍보 없이 정보 글만]`;

    const telLine = (c.phone && c.phone.trim())
      ? `글의 맨 마지막을, 다른 머리말 없이 정확히 아래 형식으로 끝낼 것 (대괄호 토큰을 그대로 포함, 안의 내용만 출력):
[[CTA]]
첫 방문 평가 및 상담 무료
☎ ${c.phone}${(c.link && c.link.trim()) ? `
한국방문재활운동센터 안내 링크
${c.link.trim()}` : ""}
[[/CTA]]`
      : `전화번호가 없으므로 마지막 연락처(CTA) 줄은 넣지 말 것.`;

    const freshBlock = fresh ? `
[시의성 — 매달 갱신되는 글]
- 이 글은 같은 주제로 매달 다시 작성될 수 있어. 오늘 날짜(${dateStr || "현재"}) 기준으로 '${topic}' 관련 최근 뉴스·정책·연구 동향을 웹에서 찾아 한두 가지 자연스럽게 본문에 녹여, 지난달과 다른 글로 써줘.
- 웹 검색으로 확인된 사실만, 날짜·수치·출처를 지어내지 말 것. 뉴스는 짧게 요약만(원문 길게 베끼지 말 것).` : "";

    const refBlock = ref ? `
[상위 노출 글 참고 — 베끼기 절대 금지]
- '${topic}'(으)로 네이버/웹에 검색했을 때 상위에 노출되는 블로그 글들을 웹 검색으로 찾아, 어떤 소제목 구성·형식으로, 어떤 하위 주제들을 다뤄 검색을 잡고 있는지 먼저 파악할 것.
- 그 구성과 다루는 주제를 '참고'만 하고, 문장·표현·문단을 절대 그대로 가져오지 말 것. 반드시 더 깊고 정확하며 읽기 쉬운 '완전히 새로 쓴 글'로 업그레이드할 것. (네이버 유사문서로 판정되면 안 됨)
- 상위 글들이 공통으로 다루는 핵심은 빠짐없이 담되, 그들이 놓친 디테일·실용 팁·최신 정보를 더해 차별화할 것.
- 맞춤법·띄어쓰기·문맥을 정확하고 자연스럽게 다듬을 것.` : "";

    const keywordsBlock = keywords.length ? `
[참고용 인기 검색어 (인기순)]
${keywords.map((k, i) => `${i + 1}. ${k.keyword || k}`).join("\n")}
` : "";

    const promptText = `너는 네이버 블로그 상위노출과 블로그 지수에 정통한 방문재활·재활운동 분야 전문 작가야.
'${topic}' 주제로, 네이버 블로그에 바로 올릴 한국어 글을 써줘.

[주제]
${topic}
${keywordsBlock}${centerBlock}
${freshBlock}
${refBlock}

[제목 규칙]
- 제목(맨 앞 # 한 줄)은 항상 70~80자로 길고 구체적으로. 핵심 키워드 1~2개를 앞쪽에 자연스럽게 포함하고, 클릭하고 싶게 궁금증·혜택을 담을 것.
- 글자 수를 채우려고 "2026년 O월까지", "총정리", "최신판" 같은 날짜·시점 문구를 제목에 넣지 말 것. 대신 주제와 관련된 증상·원인·방법·대상 등 실질적인 말을 덧붙여 길이를 맞출 것.

[본문 구성 — 네이버 지수에 강하게]
- 도입 2~3문장(공감) → 본문 소제목(##) 3~4개 → 마무리. 분량 ${lenHint}.
- 각 소제목 아래는 번호 목록(1. 2. 3.)이나 불릿(•, ▸, ✓ 중 골라) 으로 문단이 딱딱 끊어져 보이게.
- 핵심 문장은 **굵게**로 강조(과하지 않게).
- 핵심 키워드를 제목·도입·소제목·본문에 자연스럽게 반복(억지 나열 금지).
- 의학적 효과 단정·과장 금지. 증상 시 전문가 상담 권유 포함.

[디자인 — 매번 다르게]
- 이모지·기호는 매번 똑같이 쓰지 말고, 이번 주제 '${topic}'의 분위기에 맞춰 그날그날 다르게 골라 써. (예: 신경계 주제면 🧠, 관절이면 🦴, 호흡/체력이면 💪 등 — 너가 주제에 맞게 자유롭게)
- 소제목 앞에 어울리는 이모지 1개, 구분이 필요하면 ─── 같은 선도 활용. 단, 장식이 글을 어수선하게 만들지 않게 절제 있게.
- 색깔·글자크기 같은 서식은 쓰지 말 것(붙여넣을 때 사라짐). 꾸밈은 '글자/이모지/기호'로만.

[출력 형식]
- 마크다운 텍스트만. 머리말·설명 없이 글만.
- ${telLine}`;

    let post;
    if (fresh || ref) {
      const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: ref ? 5 : 3 }];
      try { post = await callAnthropic([{ role: "user", content: promptText }], 4000, tools); }
      catch (e) { post = await callAnthropic([{ role: "user", content: promptText }], 3000, null); }
    } else {
      post = await callAnthropic([{ role: "user", content: promptText }], 3000, null);
    }
    return res.status(200).json({ post });
  } catch (e) {
    return res.status(500).json({ error: "생성 중 오류가 발생했습니다.", detail: String(e.message || e) });
  }
};
