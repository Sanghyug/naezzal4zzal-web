# 외부 연결 준비 — 상혁님이 필요한 순서

2026-11-24 최신: Preview 배포와 실제 DB·두 비공개 버킷 저장/조회/삭제 검증을 완료했다.
테스트 주소와 로그인 복귀 허용 등록·가입 5 중복 검사 순서는 [SUPABASE_TEST.md](SUPABASE_TEST.md)의 맨 위를 따른다.
실제 카카오 회원 로그인과 가입 지급 검증은 소유자가 직접 로그인한 뒤 이어간다. 아래 과거 준비 상태보다 이 기록이 최신이다.

작업 경로: `D:/Codex/naezzal4zzal-app`. 상품과 가격은 승인한 값으로 구현했다.
지금 필요한 것은 테스트용 로그인·DB 연결이다. 도메인 구매나 실결제 계약은 개발 시작 조건이 아니다.
키·비밀번호·신분자료는 채팅이나 Git에 붙여넣지 않고 해당 서비스의 안전한 설정 화면에 입력한다.

## 1. 카카오 로그인과 비공개 보관: Supabase 테스트 프로젝트

여기까지 완료: 로컬에서 모의 로그인·충전·취소·영상·초대를 체험할 수 있다.
DB가 재시작 후에도 잔액과 작업을 유지하는 검사, 중복·동시 요청 검사를 완료했다.
원격 DB·비공개 보관함 생성과 접근 차단은 확인했다. 앱 서버 연결과 실제 카카오 로그인은 아직 미검증이다.

원격 적용 완료: 서울 테스트 프로젝트 `cvwikgszywzlvadsvvvq`에 장부 두 개와 비공개 보관함을 생성하고 일반 역할 접근 차단을 확인했다.
앱 서버 DB·Storage 연결과 실제 카카오 로그인은 서버 비밀값·카카오 설정 입력 뒤 검증한다. Google 연동은 보류한다.

지금 필요한 사용자 작업:

1. [Kakao Developers](https://developers.kakao.com/console/app)에서 naezzal4zzal 전용 앱을 사용한다. ChantKPop 앱 설정은 변경하지 않는다.
2. 앱의 플랫폼 키에서 **REST API 키**를 확인한다. JavaScript 키나 Admin 키를 대신 넣지 않는다.
3. 카카오 로그인을 활성화하고 리디렉션 URI를 다음과 같이 등록한다.
   `https://cvwikgszywzlvadsvvvq.supabase.co/auth/v1/callback`
4. 해당 REST API 키의 **Kakao Login Client Secret**을 활성화한다.
5. [Supabase 제공자 설정](https://supabase.com/dashboard/project/cvwikgszywzlvadsvvvq/auth/providers) → Kakao에서 Client ID에 REST API 키, Client Secret에 위 비밀값을 직접 입력한다.
6. Kakao Enabled와 **Allow users without an email**을 켜고 저장한다. Google은 활성화하지 않는다.
7. 이메일(account_email), 프로필 사진(profile_image), 닉네임(profile_nickname)은 이 앱에서 사용하지 않는다. 카카오 동의항목에서 사용 안 함 상태로 둘 수 있으며, 이번 구현을 위해 활성화할 개인정보 동의항목은 없다. Supabase의 Allow users without an email은 계속 켠다.
8. Supabase URL Configuration에 최종 테스트 원본 주소의 `/?auth=return`을 정확히 허용한다. 임시로 광범위한 wildcard를 등록하지 않는다.

준비할 자료: Supabase 로그인 계정만 필요하다. 아직 사업자 서류·도메인 구매는 필요하지 않다.

코선생이 이어서 적용할 항목:

| 설정 | 위치·값 |
|---|---|
| DB | SQL Editor에서 `db/launch.sql`; TEST 프로젝트에만 먼저 적용 |
| 파일 | Storage에 `launch-inputs`, `launch-results` **비공개** 버킷 생성; 공개 정책 없음 |
| 연결 URL | 프로젝트 Connect의 PostgreSQL pooler URL; SSL 검증을 유지 |
| 서버 키 | API Keys의 서버용 service role; Vercel **Preview Secret**에만 입력 |
| 브라우저용 키 | 프로젝트 URL·anon/publishable 키; 공개용 키만 로그인 클라이언트로 전달 |
| 카카오 제공자 | Authentication → Sign In / Providers → 카카오 |
| 카카오 OAuth | [Kakao Developers](https://developers.kakao.com/console/app)의 naezzal4zzal 전용 앱 |
| 카카오 콜백 | Supabase 화면에 실제 표시되는 `https://<프로젝트>.supabase.co/auth/v1/callback` |
| Supabase 복귀 주소 | 실제 테스트 Preview 원본 주소와 `http://127.0.0.1:5173/`; 무제한 와일드카드 사용 안 함 |
| 테스트 사용자 | 카카오 앱이 개발 모드라면 앱 팀원 등 허용한 테스트 계정으로 확인 |
| 운영자 | Supabase에서 확인한 본인 사용자 UID를 서버 `LAUNCH_ADMIN_IDS`에 지정 |

카카오 Client Secret은 Supabase의 카카오 제공자 설정에 직접 입력한다.
REST API 키도 Supabase의 Client ID 칸에만 입력하며, 카카오 Secret은 Vercel이나 브라우저 코드에 넣지 않는다.
2026-11-24 공개 Auth 설정 재조회에서 Kakao=false, Google=false였다. 제공자 활성화와 이메일 없는 사용자 허용 설정은 아직 적용·검증되지 않았다.
카카오 자체 계정 삭제와 서비스 탈퇴는 다르며, 서비스 탈퇴는 Supabase Auth 계정·서버 파일을 삭제한다.
식별용 HMAC 해시는 탈퇴 후 재가입 선물 중복 방지에 90일 보관한 뒤 지운다.
거래 장부 보관의 법적 기간·표시 문구는 공개 출시 전에 별도로 확정한다.

첫 연결 때는 `LAUNCH_ENV=test`, `PAYMENT_MODE=mock`으로 두어 PG 가입 없이도 실제 카카오 로그인·DB·저장을 확인한다.
`LAUNCH_ENABLED=1`과 `VITE_LAUNCH_ENABLED=1`은 **설정이 갖춰진 Preview**에만 적용한다.
테스트 프로젝트와 나중의 운영 프로젝트는 인증·DB·버킷·환경변수 모두 분리한다.
테스트 잔액은 운영으로 옮기지 않는다.

### 카카오 전환 검증과 남은 실기기 검사

회원·크레딧·초대 장부 구조와 회원 UUID는 유지한다. 이메일로 회원을 찾거나 잔액을 합치지 않는다.
인증 서버가 확인한 카카오 식별자의 해시는 가입 선물 중복 방지에만 사용한다.
기존 Google 회원의 유효한 세션은 유지하지만 Google 신규 가입 버튼·흐름은 제공하지 않는다.
별도 카카오 계정과 기존 계정을 자동 병합하지 않는다.

KOE205 수정: Supabase 기본 Kakao scopes에는 세 항목이 하드코딩되어 있고 options.scopes는 추가만 한다.
따라서 단순 삭제 대신 `options.queryParams: { scope: "" }`로 최종 provider scope를 빈 값으로 덮어쓴다.
2026-11-24 실제 프로젝트의 302 Location에서 Kakao `/oauth/authorize?…&scope=&…`를 확인했고
accounts.kakao.com 로그인 화면(HTTP 200)으로 이동했으며 KOE205는 나타나지 않았다. 전체 state·인가 URL은 로그에 남기지 않는다.
`node scripts/verifyKakaoScope.mjs <정확한 HTTPS Preview 원본>`으로 실제 SDK→Supabase→Kakao를 재검사한다.
Supabase 업그레이드 시 이 최종 URL 검사를 다시 한다. 계정 로그인/가입 크레딧 확인을 대체하는 검사는 아니다.

자동 검사: 이메일 없는 회원의 가입·재로그인과 이메일 변경 시 장부 유지, 위조 프로필 거부,
기존 크레딧·초대 규칙, OAuth 취소 후 원본 사진 바이트·잘라내기·조정·메모·프레임 복원,
카카오톡 User-Agent 환경의 초대 링크 → GIF → 모의 Kakao OAuth → GIF 복원 → 초대자 +2를 확인했다.
OAuth 응답을 모의한 Chrome 검사이며 실제 카카오 계정·카카오톡 앱에서 성공했다는 뜻은 아니다.

키 입력·테스트 배포 후 상혁님 기기에서 확인할 순서:

1. 신규 테스터가 카카오톡에서 초대 링크를 연다. 같은 창에서 사진을 편집하고 기본 GIF를 만든 뒤 전송 동의·초대 완료 확인을 누른다.
2. 카카오 로그인을 한 번 취소하고 돌아와 사진·편집 내용·GIF가 유지되는지 확인한다.
3. 다시 카카오로 시작하기를 눌러 이메일 동의 없이 가입한다. 가입자 +5, 초대자 +2를 확인한다.
4. 새로고침·재로그인해도 초대 보상이 추가 지급되지 않는지 확인한다. 이미 가입한 계정과 자기 초대는 보상 대상이 아니다.
5. iPhone·Android에서 각각 검사한다. 외부 브라우저로 창을 바꾸면 IndexedDB·초대 쿠키가 공유되지 않으므로 같은 창에서 왕복해야 한다.

## 2. 토스페이먼츠 테스트 결제

카카오와 DB 연결이 확인된 뒤 다음을 진행한다. 그동안 모의 결제로 독립적인 개발·검사는 가능하다.

1. [토스페이먼츠 개발자센터](https://developers.tosspayments.com/)에 로그인한다.
2. API 키 메뉴에서 **주문서형 결제/결제위젯**에 맞는 테스트 클라이언트 키와 테스트 시크릿 키를 확인한다.
3. [Vercel 프로젝트 환경변수](https://vercel.com/sanghyug-park-s-projects/naezzal4zzal-web/settings/environment-variables)의
   **Preview**에 `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`를 안전하게 입력한다.
   `PAYMENT_MODE=toss-test`로 전환한다. 키를 채팅으로 보내지 않는다.
4. 코선생이 서버 설정에서 테스트 충전을 켠 뒤 3,900원 승인→10 지급→새로고침/웹훅 중복→취소를 검증한다.

테스트 결제는 실제 돈이 출금되지 않는다. 실제 토스 테스트 승인·취소는 키 미등록으로 아직 미검증이다.
실패·중단 주문은 지급하지 않고, 승인 후 DB 반영 실패는 PG 결제 조회로 복구한다.
테스트 환경에서는 기존 HeyGen 키가 있어도 실제 영상 공급자를 호출할 수 없다.

고정 상품:

> 내짤4짤 AI 영상 제작 10크레딧 — 최종 3,900원(KRW).
> 실사 1, 펜화 3크레딧. 서비스 안에서만 사용하며 양도·현금 교환·자동 충전을 제공하지 않음.

PG의 실제 상점 심사에서 충전형 상품 취급 가능 여부, 회원 전용 경로, 구매 한도,
수수료·정산·취소 조건을 확인해야 한다. 임의로 심사 통과를 보장하지 않는다.
실제 상점 키는 계약·본인 확인 이후다. 가입 화면에서 요구하는 서류를 확인한 다음
최소한의 사업자등록 정보·정산계좌 등을 준비한다. 현재 임의로 서류를 일괄 요구하지 않는다.

## 3. 도메인 — 지금 구매하지 않아도 됨

2026-11-23 공식 `.com` 등록부 RDAP 조회에서 `naezzal4zzal.com` 등록 기록이 없었다(HTTP 404).
이는 구매 가능 확정이나 예약이 아니다. 구매 직전에 등록업체 검색·체크아웃을 다시 확인한다.

| 후보·구매처 | 첫해 기본 가격 | 갱신 기본 가격 | 확인할 내용 |
|---|---:|---:|---|
| naezzal4zzal.com / Cloudflare Registrar | $11.17 / 1년 | $11.17 / 1년 | 정확한 주소 가용성·프리미엄 여부·세금·환산·자동갱신 선택은 결제 화면에서 재확인 |

근거: [Cloudflare 공식 가격표](https://pricing.registrar.cloudflare.com/?q=com).
현재 불가 판정이 아니므로 불필요하게 대안 주소를 늘리지 않았다.
최종 구매 화면을 한 화면에서 확인할 수 있게 준비한 다음 상혁님이 명의·결제·자동갱신을 직접 확인한다.
구매처 계정 생성·약관 동의·유료 구입을 이번 작업에서 대신 하지 않았다.

구매 후 코선생이 할 일:

- Vercel **naezzal4zzal-web** 프로젝트에 정확한 루트 주소와 www를 등록한다.
- 그 프로젝트가 실제 제시하는 DNS 레코드를 사용한다. 예제 IP/CNAME을 쓰지 않는다.
- Cloudflare를 쓰는 경우 Cloudflare DNS에서 적용하고 기존 MX/TXT/메일 레코드를 보존한다.
- 루트 대표 주소, www 리디렉션, HTTPS, CORS, OAuth 허용 주소·콜백,
  결제 성공·실패 주소·웹훅, `APP_BASE_URL`, 초대 링크를 같은 주소로 검증한다.
- ChantKPop 프로젝트·도메인·공용 인증 설정은 변경하지 않는다.

## 4. 실제 공개 전에만 필요한 사항

- Vercel 상업 이용에 맞는 요금제. Hobby는 개인·비상업용이며 운영용 `vercel.launch.json`의
  2분 주기 복구 작업은 Pro 같은 세부 주기 지원 요금제가 필요하다. 새 계약은 상혁님이 확인한다.
- 별도 `naezzal4zzal-production` Supabase 프로젝트와 운영 키. 테스트 장부/계정/파일을 복사하지 않는다.
- 실제 상호·대표자·사업자등록번호·주소·비공개 고객 연락처·과세 유형·통신판매업 표시 확인.
  알려진 밤나무랩·박상혁 외의 값은 지어내지 않았다.
- [정부24 통신판매업 신고 안내](https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=11300000006)에서
  적용 요건을 확인한다. 사업자등록증명, 해당되는 경우 구매안전서비스 확인증 등이 안내되지만
  이 디지털 크레딧 판매의 적용·면제·대체 요건을 확정했다고 간주하지 않는다.
- PG가 요구하는 회원 전용 심사 계정/결제 경로 자료를 제공한다. 공개 인증 우회는 만들지 않는다.
- 실제 사진 공개 사례 사용 권한, 제공업체 해외 처리/보관 안내, 부분 환불 정책,
  거래 기록 보관 기간을 확인해 현재 초안을 최종 정책으로 바꾼다.
- 상혁님이 iPhone/Android/카카오톡에서 로그인·사진 보존·저장·공유·결제 복귀를 검수한다.
- 마지막에 상혁님이 3,900원 **실결제 한 번과 취소**를 직접 확인하고 공개 여부를 판단한다.

## 설정 이름 목록

### 현재 테스트 Preview에 입력할 값 (2026-11-24 확정)

[Vercel 환경변수](https://vercel.com/sanghyug-park-s-projects/naezzal4zzal-web/settings/environment-variables)에서
환경은 **Preview만**, Git branch는 **codex/launch-credits-20261123**로 제한한다.
먼저 소유자가 아래 두 항목을 Sensitive로 직접 입력한다. 채팅·로컬 파일에는 복사하지 않는다.

| 변수명 | 값 |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | naezzal4zzal-test의 신형 `sb_secret_…` 키 원문. 이름은 호환성을 위해 유지 |
| `LAUNCH_DATABASE_URL` | 같은 테스트 프로젝트 Connect → Transaction pooler → PostgreSQL URI. 비밀번호 포함, 보통 포트 6543. SSL 검증 유지 |

`sb_secret_…`는 DB 비밀번호나 회원 로그인 토큰이 아니다. 첫 변수는 Auth 관리·Storage용,
두 번째는 장부 PostgreSQL 연결용이므로 서로 대체하지 않는다. Kakao Client Secret은 Supabase에만 둔다.

입력 완료 뒤 코선생이 다음 나머지 Preview 설정을 적용하고 재배포한다. 지금 사용자에게 비밀값 생성을 요구하지 않는다.

| 변수명 | 설정 |
|---|---|
| `SUPABASE_URL` | `https://cvwikgszywzlvadsvvvq.supabase.co` |
| `SUPABASE_ANON_KEY` | 같은 프로젝트의 공개용 `sb_publishable_…`. 서버 secret을 넣으면 안 됨 |
| `LAUNCH_COOKIE_SECRET`, `IDENTITY_HASH_SECRET`, `CRON_SECRET` | 각각 별도 32바이트 이상 난수. 값을 출력하지 않고 서버 환경변수에 전달. 이후 배포 때 유지 |
| `LAUNCH_ENV` | `test` |
| `PAYMENT_MODE` | `mock` |
| `ENABLE_LIVE_GENERATION`, `LIVE_COMMERCE_APPROVED`, `BUSINESS_DETAILS_VERIFIED` | `0` |
| `LAUNCH_ENABLED`, `VITE_LAUNCH_ENABLED`, `LAUNCH_PREVIEW_SAFE` | `1` |

`LAUNCH_DEMO`는 Vercel에 등록하지 않는다. `APP_BASE_URL`은 최초 Preview에서 생략하면
Vercel이 제공한 해당 배포의 HTTPS 주소를 사용한다. 고정 테스트 별칭을 정할 때 그 주소로 명시한다.
`VITE_API_BASE_URL`도 최초 웹 Preview에는 생략하여 같은 원본의 API를 호출한다.
운영 주소가 들어간 Preview 변수가 있다면 테스트 브랜치에서 제거·교정한다.
`LAUNCH_ADMIN_IDS`는 실제 로그인 후 확인한 소유자 UUID만 추가한다.
최종 Preview의 `/?auth=return`을 Supabase Redirect URLs에 정확히 등록한 뒤 실제 카카오 왕복을 검사한다.

설치 SDK `@supabase/supabase-js` 2.119.2를 고정했다. 서버 공통 연결은 신형 키를 `apikey`에 두고
SDK가 복사한 `Authorization: Bearer sb_secret_…`를 제거한다. 실제 회원 JWT Authorization은 보존한다.
가짜 키로 실제 SDK의 Storage 업로드·다운로드·삭제, Auth admin, getUser 요청 형식을 검증했으며
실제 서버 키·DB를 이용한 검사는 Vercel 입력과 재배포 후 진행한다.
공식 근거: [신형 API 키 이전 안내](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

`.env.example`에 빈 항목과 안전한 기본값이 있다. 실제 값은 Git/문서/로그에 남기지 않는다.

| 서버 설정 | 용도 |
|---|---|
| LAUNCH_PREVIEW_SAFE | 화면 전용 Preview에서 1: 기존 사진 분석·사무실 영상 생성도 차단 |
| LAUNCH_ENABLED / LAUNCH_ENV | 출시 서버 켜기 / test 또는 production 장부 구분 |
| LAUNCH_DATABASE_URL | 해당 환경 PostgreSQL 연결 |
| SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY | 해당 환경 인증·비공개 파일 |
| LAUNCH_COOKIE_SECRET / IDENTITY_HASH_SECRET | 독립적인 32바이트 이상 난수; 방문 서명·식별 해시 |
| LAUNCH_ADMIN_IDS | 허용한 운영자 UID 목록 |
| APP_BASE_URL / ALLOWED_ORIGINS | 정확한 서비스 주소·허용 원본 |
| PAYMENT_MODE / TOSS_CLIENT_KEY / TOSS_SECRET_KEY | mock → toss-test → 승인 후 live |
| LIVE_COMMERCE_APPROVED | 실결제·심사 확인 후에만 1 |
| ENABLE_LIVE_GENERATION | 운영 환경·live 결제·승인 플래그가 모두 맞아야 실제 HeyGen 호출 |
| CRON_SECRET | 복구/보관 삭제 작업 인증; 32바이트 이상 난수 |
| PUBLIC_SUPPORT_EMAIL / BUSINESS_DETAILS_VERIFIED | 확인된 비공개 문의처 / 표시 검증 상태 |
| OPENAI_API_KEY / HEYGEN_API_KEY | 기존 서버 키. 외부로 내려받지 않음 |

`VITE_LAUNCH_ENABLED`는 공개용 화면 표시 플래그다. 서버 키를 VITE_ 변수에 넣지 않는다.
로컬 `npm run dev:launch`만 모의 로그인 계정을 허용한다. Vercel에서는 모의 로그인 우회가 작동하지 않는다.
`LAUNCH_PREVIEW_CHECK`는 이번 서버 오디오 제거 검사용 일회성 Preview 전용 값이며 운영에 등록하지 않는다.

## 공식 연동 근거

- https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/storage/security/access-control
- https://docs.tosspayments.com/guides/v2/get-started/environment
- https://docs.tosspayments.com/guides/v2/payment-widget/integration
- https://docs.tosspayments.com/reference
- https://www.tosspayments.com/blog/articles/21130
- https://vercel.com/docs/domains/set-up-custom-domain
- https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing
