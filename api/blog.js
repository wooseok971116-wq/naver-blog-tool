// api/blog.js — Anthropic API로 블로그 글과 삽화(SVG)를 생성하는 서버 함수
// POST { type:"post", topic, keywords, tone, length, photos[], generateImages }  -> { post, mode, imgCount }
// POST { type:"image", caption }                                                 -> { svg }

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
    // ── 삽화 1장 생성 ──
    if (body.type === "image") {
      const cap = (body.caption || "재활운동 관련 삽화").toString();
      const raw = await callAnthropic([{ role: "user", content:
`방문재활·재활운동 블로그용 삽화를 SVG로 그려줘.
내용: ${cap}
조건: viewBox="0 0 400 240", 배경 사각형 포함, 단순하고 깔끔한 플랫 일러스트, 도형 위주로 요소 최소화.
색은 차분하게: #2F6B5E, #DCEAE4, #E07856, #16271F, #F4F7F5 위주.
설명·코드펜스 없이 <svg>...</svg> 코드만 출력.` }], 1500);
      const m = raw.match(/<svg[\s\S]*<\/svg>/i);
      const svg = m ? m[0].replace(/<script[\s\S]*?<\/script>/gi, "") : null;
      return res.status(200).json({ svg });
    }

    // ── 블로그 글 생성 ──
    const topic = body.topic || "방문재활, 재활운동";
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    const tone = body.tone || "따뜻하고 친근하게";
    const length = (body.length || "보통").toString();
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 5) : [];
    const generateImages = !!body.generateImages;
    const useGenerated = generateImages || photos.length === 0;

    const lenBase = length.includes("짧") ? 2 : length.includes("길") ? 4 : 3;
    const imgCount = useGenerated
      ? Math.min(4, Math.max(2, lenBase))
      : Math.min(photos.length, Math.max(2, lenBase), 5);
    const lenHint = length.includes("짧") ? "600~800자" : length.includes("길") ? "1300자 이상" : "900~1100자";

    const imgRule = `
[이미지 배치 규칙]
- 본문에 이미지를 정확히 ${imgCount}장 넣어줘.
- 넣을 위치마다 [[IMG:1]] 처럼 단독 줄로 표시 (번호는 1부터 ${imgCount}까지 순서대로).
- 각 [[IMG:n]] 바로 다음 줄에 캡션을 "> "로 시작해 한 줄 써줘.
- 도입부 아래부터 단락 사이사이로 고르게 분산.${
      useGenerated
        ? '\n- 캡션에는 그 자리에 들어갈 그림이 무엇을 보여줘야 하는지 구체적으로 묘사해줘.'
        : '\n- 함께 보낸 사용자 사진을 순서대로 [[IMG:1]]=첫 번째 사진 으로 보고, 어울리는 위치에 배치하고 캡션을 써줘.'
    }`;

    const promptText = `너는 방문재활·재활운동 분야의 전문 블로그 작가야.
아래 인기 검색 키워드가 자연스럽게 녹아든, 네이버 블로그에 바로 올릴 한국어 글을 써줘.

[주제]
${topic}

[인기 검색 키워드 (검색량 순)]
${keywords.map((k, i) => `${i + 1}. ${k.keyword || k}${k.total ? ` (월 ${Number(k.total).toLocaleString()}회)` : ""}`).join("\n")}

[작성 규칙]
- 말투: ${tone}
- 분량: ${lenHint}
- 맨 앞에 매력적인 제목 1개 (# 으로 시작)
- 소제목(##) 2~3개로 구성
- 의학적 효과를 단정·과장하지 말 것. 증상이 있으면 전문가(의사·물리치료사) 상담을 권하는 문장을 자연스럽게 포함
- 마크다운만 출력 (다른 머리말 없이 글만)
${imgRule}`;

    let content;
    if (!useGenerated) {
      content = [
        ...photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType || "image/jpeg", data: p.base64 } })),
        { type: "text", text: promptText },
      ];
    } else {
      content = promptText;
    }

    const post = await callAnthropic([{ role: "user", content }], 2000);
    return res.status(200).json({ post, mode: useGenerated ? "generated" : "uploaded", imgCount });
  } catch (e) {
    return res.status(500).json({ error: "생성 중 오류가 발생했습니다.", detail: String(e.message || e) });
  }
};
