# 외부 연결 준비 — 상혁님이 필요한 순서

작업 경로: `D:/Codex/naezzal4zzal-app`. 상품과 가격은 승인한 값으로 구현했다.
지금 필요한 것은 테스트용 로그인·DB 연결이다. 도메인 구매나 실결제 계약은 개발 시작 조건이 아니다.
키·비밀번호·신분자료는 채팅이나 Git에 붙여넣지 않고 해당 서비스의 안전한 설정 화면에 입력한다.

## 1. Google 로그인과 비공개 보관: Supabase 테스트 프로젝트

여기까지 완료: 로컬에서 모의 로그인·충전·취소·영상·초대를 체험할 수 있다.
DB가 재시작 후에도 잔액과 작업을 유지하는 검사, 중복·동시 요청 검사를 완료했다.
실제 Supabase 연결과 Google 로그인을 통과했다고 보고하지는 않는다.

지금 필요한 사용자 작업:

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인한다.
2. 기존 naezzal4zzal 전용 테스트 프로젝트가 있으면 그것을 사용한다. 없다면
   `naezzal4zzal-test` 프로젝트를 만들고 지역은 가능한 서울을 선택한다.
   DB 비밀번호는 그 화면에서 직접 정하고 안전하게 보관한다. 다른 앱 프로젝트를 재사용하지 않는다.
3. 프로젝트의 공개 URL 또는 프로젝트 식별자만 코선생에게 알려준다.
   그 다음 실제 프로젝트 화면 기준으로 SQL·비공개 버킷·Vercel 환경변수 연결을 이어간다.

준비할 자료: Supabase 로그인 계정만 필요하다. 아직 사업자 서류·도메인 구매는 필요하지 않다.

코선생이 이어서 적용할 항목:

| 설정 | 위치·값 |
|---|---|
| DB | SQL Editor에서 `db/launch.sql`; TEST 프로젝트에만 먼저 적용 |
| 파일 | Storage에 `launch-inputs`, `launch-results` **비공개** 버킷 생성; 공개 정책 없음 |
| 연결 URL | 프로젝트 Connect의 PostgreSQL pooler URL; SSL 검증을 유지 |
| 서버 키 | API Keys의 서버용 service role; Vercel **Preview Secret**에만 입력 |
| 브라우저용 키 | 프로젝트 URL·anon/publishable 키; 공개용 키만 로그인 클라이언트로 전달 |
| Google 제공자 | Authentication → Sign In / Providers → Google |
| Google OAuth | [Google Auth Platform Clients](https://console.cloud.google.com/auth/clients)의 웹 애플리케이션 클라이언트 |
| Google 콜백 | Supabase 화면에 실제 표시되는 `https://<프로젝트>.supabase.co/auth/v1/callback` |
| Supabase 복귀 주소 | 실제 테스트 Preview 원본 주소와 `http://127.0.0.1:5173/`; 무제한 와일드카드 사용 안 함 |
| 테스트 사용자 | Google 동의 화면이 테스트 상태면 상혁님·승인된 테스터 이메일만 추가 |
| 운영자 | Supabase에서 확인한 본인 사용자 UID를 서버 `LAUNCH_ADMIN_IDS`에 지정 |

Google Client Secret은 Supabase의 Google 제공자 설정에 직접 입력한다.
Google 자체 계정 삭제와 서비스 탈퇴는 다르며, 서비스 탈퇴는 Supabase Auth 계정·서버 파일을 삭제한다.
식별용 HMAC 해시는 탈퇴 후 재가입 선물 중복 방지에 90일 보관한 뒤 지운다.
거래 장부 보관의 법적 기간·표시 문구는 공개 출시 전에 별도로 확정한다.

첫 연결 때는 `LAUNCH_ENV=test`, `PAYMENT_MODE=mock`으로 두어 PG 가입 없이도 실제 Google 로그인·DB·저장을 확인한다.
`LAUNCH_ENABLED=1`과 `VITE_LAUNCH_ENABLED=1`은 **설정이 갖춰진 Preview**에만 적용한다.
테스트 프로젝트와 나중의 운영 프로젝트는 인증·DB·버킷·환경변수 모두 분리한다.
테스트 잔액은 운영으로 옮기지 않는다.

## 2. 토스페이먼츠 테스트 결제

Google와 DB 연결이 확인된 뒤 다음을 진행한다. 그동안 모의 결제로 독립적인 개발·검사는 가능하다.

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

- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/storage/security/access-control
- https://docs.tosspayments.com/guides/v2/get-started/environment
- https://docs.tosspayments.com/guides/v2/payment-widget/integration
- https://docs.tosspayments.com/reference
- https://www.tosspayments.com/blog/articles/21130
- https://vercel.com/docs/domains/set-up-custom-domain
- https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing
