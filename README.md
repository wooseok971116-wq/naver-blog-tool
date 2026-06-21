# 네이버 월간 검색량 top50 연동 (백엔드)

이 폴더는 "방문재활·재활운동 블로그 생성기"의 **네이버 연동 절반**입니다.
버튼을 누르면 네이버에서 연관 키워드 + 월간 검색량을 가져와 **검색량 순 top50**을 돌려줍니다.

---

## 왜 이게 따로 필요한가

네이버 키워드도구 API는 **비밀키로 서명**해서 호출해야 하고, 브라우저에서 직접 부르는 걸 막아둡니다.
그래서 키를 숨기고 대신 호출해 주는 **작은 서버 함수**가 하나 필요합니다. 그게 `api/keywords.js` 입니다.
(채팅 미리보기 안에서는 못 돌아가고, 아래처럼 배포해야 실제로 동작합니다.)

---

## 1단계 · 네이버 키 3개 발급 (무료)

1. https://searchad.naver.com 접속 → 회원가입/로그인
2. 상단 **도구 → API 사용관리** 이동
3. **네이버 검색광고 API 서비스 신청** 후, 아래 3개를 발급/확인:
   - **액세스 라이선스** → `NAVER_API_KEY`
   - **비밀키** → `NAVER_SECRET_KEY`
   - **고객 ID(CUSTOMER_ID, 숫자)** → `NAVER_CUSTOMER_ID`

---

## 2단계 · 배포 (Vercel, 무료, 컴퓨터 권장)

1. https://vercel.com 가입 (GitHub 계정으로 가능)
2. 이 폴더(`naver-blog-tool`)를 GitHub 저장소에 올리고 Vercel에 연결
   (또는 Vercel CLI: `npm i -g vercel` → 폴더에서 `vercel`)
3. Vercel 프로젝트 **Settings → Environment Variables** 에 위 3개 키 등록
   (이름은 `.env.example` 과 똑같이: `NAVER_API_KEY`, `NAVER_SECRET_KEY`, `NAVER_CUSTOMER_ID`)
4. 배포 완료되면 주소가 생깁니다. 예: `https://내프로젝트.vercel.app`

---

## 3단계 · 동작 확인

브라우저 주소창에 이렇게 입력해서 JSON이 나오면 성공입니다:

```
https://내프로젝트.vercel.app/api/keywords?keyword=방문재활,재활운동
```

응답 예시:

```json
{
  "seeds": ["방문재활", "재활운동"],
  "count": 50,
  "keywords": [
    { "keyword": "재활운동", "pc": 3100, "mobile": 30000, "total": 33100 },
    { "keyword": "물리치료", "pc": 5400, "mobile": 22000, "total": 27400 }
  ]
}
```

---

## 전체 사이트 (화면 + 글쓰기 AI)

이 폴더에는 완성 사이트 파일이 모두 들어 있습니다:
- `index.html` — 실제 화면 (키워드 불러오기 + 사진 업로드 + 글 생성)
- `api/keywords.js` — 네이버 월간 top50
- `api/blog.js` — 블로그 글/삽화 생성 (Anthropic API 사용)

### Anthropic API 키 발급 (글쓰기 AI용)

글 쓰는 AI를 내 사이트에서 돌리려면 Anthropic API 키가 필요합니다. (사용한 만큼 결제 — 글 1편당 수십 원 수준)

1. https://console.anthropic.com 접속 → 가입/로그인 (Claude 구독과는 별개 계정 개념)
2. **Billing**에서 결제수단 등록 + 소액 크레딧 충전 (예: $5)
3. **API Keys → Create Key** → 키 복사 (`sk-ant-...`)

### 배포에 반영하기

1. GitHub 저장소에 이 폴더의 새 파일들(`index.html`, `api/blog.js`)을 **업로드**(덮어쓰기)하고 commit
2. Vercel은 main 브랜치에 올라오면 **자동으로 다시 배포**합니다
3. Vercel **Settings → Environment Variables** 에 키를 하나 더 추가:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
   - 추가 후 **Redeploy** (Deployments 탭에서 최신 배포의 ⋯ → Redeploy)

### 완성!

이제 사이트 주소(`https://...vercel.app`)로 들어가면 첫 화면이 떠요.
"네이버 top50 불러오기 → (사진 올리기) → 블로그 글 생성" 순서로 쓰면 됩니다.
