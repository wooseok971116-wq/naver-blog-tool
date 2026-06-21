// api/keywords.js — 네이버 자동완성에서 "사람들이 실제로 많이 검색한 검색어/질문" top50을 가져온다.
// 호출: GET /api/keywords?keyword=파킨슨
// 자동완성은 인기순으로 정렬되어 나오며, 질문/문장형 장꼬리 검색어를 포함한다.

function acUrl(q) {
  const p = new URLSearchParams({
    q, con: "1", frm: "nx", ans: "2", r_format: "json", r_enc: "UTF-8",
    r_unicode: "0", t_koreng: "1", run: "2", rev: "4", q_enc: "UTF-8", st: "100",
  });
  return "https://ac.search.naver.com/nx/ac?" + p.toString();
}

async function fetchAc(q) {
  try {
    const r = await fetch(acUrl(q), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://search.naver.com/",
        "Accept": "application/json, text/javascript, */*",
      },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const groups = Array.isArray(data.items) ? data.items : [];
    let flat = [];
    for (const g of groups) if (Array.isArray(g)) flat = flat.concat(g);
    return flat
      .map((it) => (Array.isArray(it) ? it[0] : it))
      .filter((s) => typeof s === "string" && s.trim());
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const seed = (req.query.keyword || "방문재활").toString().split(",")[0].trim();
  if (!seed) return res.status(400).json({ error: "키워드를 입력하세요." });

  try {
    // 1차: 씨앗 키워드 자동완성 (가장 인기 있는 검색어)
    const first = await fetchAc(seed);
    // 2차: 상위 8개를 한 단계 더 펼쳐 질문·문장형 장꼬리 검색어 확보 (소규모만)
    const children = await Promise.all(first.slice(0, 8).map((q) => fetchAc(q)));

    const seen = new Set();
    const out = [];
    for (const list of [first, ...children]) {
      for (const phrase of list) {
        const key = phrase.trim();
        if (key && key !== seed && !seen.has(key)) {
          seen.add(key);
          out.push(key);
        }
        if (out.length >= 50) break;
      }
      if (out.length >= 50) break;
    }

    return res.status(200).json({ seed, count: out.length, keywords: out.map((p) => ({ keyword: p })) });
  } catch (e) {
    return res.status(500).json({ error: "검색어를 불러오지 못했습니다.", detail: String(e) });
  }
};
