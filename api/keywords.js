// api/keywords.js
// 네이버 검색광고 "키워드도구" API로 연관 키워드 + 월간 검색량을 가져와
// 검색량 순으로 top50을 돌려주는 서버 함수 (Vercel / Netlify Functions 호환).
//
// 호출 예) GET /api/keywords?keyword=방문재활,재활운동
// 응답 예) { seeds:[...], count: 50, keywords: [{ keyword, pc, mobile, total }, ...] }

const crypto = require("crypto");

// 네이버 서명 만들기: HMAC-SHA256( "{timestamp}.{method}.{uri}" ) → base64
function sign(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac("sha256", secretKey).update(message).digest("base64");
}

// "< 10" 같은 문자열도 숫자로 정리
function toNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.includes("<")) return 10; // "< 10" 은 10 미만 → 10으로 처리
    const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

module.exports = async function handler(req, res) {
  // 다른 도메인(프론트)에서 불러올 수 있게 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const API_KEY = process.env.NAVER_API_KEY;        // 액세스 라이선스
  const SECRET_KEY = process.env.NAVER_SECRET_KEY;  // 비밀키
  const CUSTOMER_ID = process.env.NAVER_CUSTOMER_ID; // 고객 ID(숫자)

  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    return res.status(500).json({
      error: "네이버 API 키가 설정되지 않았습니다. 환경변수 3개를 확인하세요.",
    });
  }

  // 씨앗 키워드 (최대 5개, 공백 제거 권장)
  const raw = (req.query.keyword || "방문재활,재활운동").toString();
  const seeds = raw
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .slice(0, 5);
  const hint = seeds.join(",");

  const timestamp = Date.now().toString();
  const uri = "/keywordstool";
  const signature = sign(timestamp, "GET", uri, SECRET_KEY);
  const url = `https://api.naver.com${uri}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`;

  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": API_KEY,
        "X-Customer": String(CUSTOMER_ID),
        "X-Signature": signature,
      },
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: "네이버 API 호출 실패", status: r.status, detail });
    }

    const data = await r.json();
    const keywords = (data.keywordList || [])
      .map((k) => {
        const pc = toNum(k.monthlyPcQcCnt);
        const mobile = toNum(k.monthlyMobileQcCnt);
        return { keyword: k.relKeyword, pc, mobile, total: pc + mobile };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 50);

    return res.status(200).json({ seeds, count: keywords.length, keywords });
  } catch (e) {
    return res.status(500).json({ error: "요청 중 오류가 발생했습니다.", detail: String(e) });
  }
};
