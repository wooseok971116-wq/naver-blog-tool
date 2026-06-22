// api/history.js — 대표님(브라우저)별 블로그 기록을 Supabase에 저장/조회한다.
// 같은 키워드로 또 써도 이전 제목·소제목·요지를 피해가도록 하는 "중복 방지"용.
//
// GET  /api/history?user_id=...&topic=파킨슨   -> { items: ["제목/소제목/요지", ...] }  (최근 25건 묶음)
// POST /api/history  { user_id, topic, items: [...] }  -> { ok: true }

const KEEP = 25; // 키워드당 최근 몇 '건(글)'까지 기억할지 (퀄리티 위해 작게 유지)

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  return { url, key, ok: !!(url && key) };
}

function headers(key) {
  return {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url, key, ok } = env();
  // 서버에 키가 없으면 기록 기능만 조용히 끔(글 생성은 계속 동작해야 하므로 에러 대신 빈 결과).
  if (!ok) {
    if (req.method === "GET") return res.status(200).json({ items: [], disabled: true });
    return res.status(200).json({ ok: false, disabled: true });
  }

  try {
    if (req.method === "GET") {
      const user_id = (req.query.user_id || "").toString().trim();
      const topic = (req.query.topic || "").toString().trim();
      if (!user_id || !topic) return res.status(200).json({ items: [] });

      // 이 사용자 + 이 키워드의 최근 KEEP건을 가져온다.
      const q = `${url}/rest/v1/blog_history?select=items&user_id=eq.${encodeURIComponent(user_id)}&topic=eq.${encodeURIComponent(topic)}&order=created_at.desc&limit=${KEEP}`;
      const r = await fetch(q, { headers: headers(key) });
      if (!r.ok) return res.status(200).json({ items: [] });
      const rows = await r.json();
      const items = [];
      for (const row of rows) {
        const arr = Array.isArray(row.items) ? row.items : [];
        for (const it of arr) if (typeof it === "string" && it.trim()) items.push(it.trim());
      }
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      body = body || {};
      const user_id = (body.user_id || "").toString().trim();
      const topic = (body.topic || "").toString().trim();
      const items = Array.isArray(body.items) ? body.items.filter(x => typeof x === "string" && x.trim()).slice(0, 12) : [];
      if (!user_id || !topic || !items.length) return res.status(200).json({ ok: false });

      // 1) 새 기록 저장
      const ins = await fetch(`${url}/rest/v1/blog_history`, {
        method: "POST",
        headers: { ...headers(key), "Prefer": "return=minimal" },
        body: JSON.stringify({ user_id, topic, items }),
      });
      if (!ins.ok) {
        const t = await ins.text();
        return res.status(200).json({ ok: false, detail: t });
      }

      // 2) KEEP건을 넘는 오래된 기록은 정리 (이 사용자+키워드 한정)
      try {
        const listUrl = `${url}/rest/v1/blog_history?select=id&user_id=eq.${encodeURIComponent(user_id)}&topic=eq.${encodeURIComponent(topic)}&order=created_at.desc`;
        const lr = await fetch(listUrl, { headers: headers(key) });
        if (lr.ok) {
          const rows = await lr.json();
          if (Array.isArray(rows) && rows.length > KEEP) {
            const oldIds = rows.slice(KEEP).map(r => r.id);
            if (oldIds.length) {
              const inList = `(${oldIds.join(",")})`;
              await fetch(`${url}/rest/v1/blog_history?id=in.${encodeURIComponent(inList)}`, {
                method: "DELETE",
                headers: { ...headers(key), "Prefer": "return=minimal" },
              });
            }
          }
        }
      } catch (_) { /* 정리 실패는 무시 (다음 번에 다시 시도) */ }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "GET 또는 POST만 허용됩니다." });
  } catch (e) {
    // 기록 기능 오류가 글 생성을 막지 않도록 200으로 부드럽게 반환
    return res.status(200).json({ ok: false, items: [], detail: String(e.message || e) });
  }
};
