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

## 다음 단계

이 백엔드가 살아 있으면, 블로그 생성기 화면의 **"네이버에서 top50 불러오기"** 버튼이
이 주소(`/api/keywords`)를 불러서 키워드 칸을 자동으로 채우게 연결하면 됩니다.
글 쓰는 AI까지 배포본에서 돌리려면 같은 방식의 작은 함수(`api/blog.js`)를 하나 더 두고
본인 API 키를 환경변수로 넣으면 됩니다. (원하면 그 파일도 만들어 드릴게요.)
