# Supabase 테스트 연결 — 2026-11-24

## 현재 배포 검증 결과

- 테스트 주소: https://naezzal4zzal-b0lcm7ksl-sanghyug-park-s-projects.vercel.app
- Vercel Preview, 브랜치 `codex/launch-credits-20261123`. 운영 배포 아님.
- 사용자가 입력한 두 Secret은 내려받지 않았다. 나머지 공개 키·독립 난수·테스트 플래그를 브랜치 Preview에만 등록했다.
- 실제 PostgreSQL 장부 읽기/트랜잭션 성공. 신형 서버 키로 두 버킷의 합성 파일 쓰기·읽기·삭제와 공개 URL 접근 차단 성공.
- 시험 파일은 모두 삭제했다. 사용자 파일·회원·장부 초기화 없음.
- 실제 `paymentMode=mock`, `videoMode=mock`, `demo=false`. 유료 영상과 기존 유료 사진 분석 경로 차단.
- Kakao Enabled=true, Google=false 재조회 확인. 실제 회원 로그인·가입 선물은 소유자의 로그인 후 검증해야 한다.
- 일회성 검증 경로는 Preview·test·mock·독립 비밀값으로 보호되며 비밀값 없는 호출은 거부했다. 회원 인증 우회/가짜 회원 생성 기능은 없다.

### 소유자가 직접 확인할 순서

1. Supabase Authentication → URL Configuration → Redirect URLs에 위 테스트 원본 주소의 `/?auth=return`을 정확히 추가·저장한다. Kakao Developers의 콜백은 기존 Supabase `/auth/v1/callback` 그대로 유지한다.
2. 테스트 주소를 연다. Vercel 보호 화면이 보이면 배포 소유자 계정으로 로그인한다.
3. 처음에는 외부 기본 브라우저에서 `내 크레딧 · 로그인` → `카카오로 시작하기`를 누른다. 이메일 없이 가입·복귀한다.
4. 신규 회원은 5크레딧, 새로고침·로그아웃·같은 카카오 계정 재로그인 뒤에도 총 5인지 확인한다. 원래 사용·충전 내역이 있다면 잔액 대신 가입 선물 내역이 정확히 한 건인지 확인한다.
5. 기본 GIF 제작은 무료다. 사진 편집 후 로그인 취소·복귀 시 사진·편집 상태가 유지되는지 확인한다.
6. 시험용 AI 제작 버튼은 실제 AI 대신 모의 영상만 생성하며 크레딧 예약·사용과 비공개 결과 저장을 시험한다. 실제 결제는 하지 않는다.
7. 기본 브라우저 성공 뒤 카카오톡 인앱에서도 같은 창으로 왕복한다. Vercel 보호 로그인과 Supabase 복귀 주소 허용이 먼저 필요하다.

원격 장부의 회원·가입 선물 건수는 소유자 로그인 후 읽기 전용으로 확인한다. 키·카카오 비밀번호를 채팅으로 받지 않는다.

대상은 상혁님이 만든 **naezzal4zzal-test**, 서울 프로젝트다.

- 공개 URL: https://cvwikgszywzlvadsvvvq.supabase.co
- 프로젝트 식별자: `cvwikgszywzlvadsvvvq`
- 카카오 허용 콜백: `https://cvwikgszywzlvadsvvvq.supabase.co/auth/v1/callback`

2026-11-24 연결 도구로 프로젝트 이름·서울 지역·정상 가동을 확인하고 원격 설정을 적용했다.

- `launch_state`, `launch_audit` 생성, RLS 활성화. anon/authenticated의 읽기·쓰기 권한 없음.
- 공개 키로 실제 REST 요청을 보내 두 테이블 모두 401/42501 접근 거부를 확인했다.
- `launch-inputs`: 비공개, JSON만, 최대 4 MiB.
- `launch-results`: 비공개, MP4만, 최대 12 MiB. 일반 사용자 Storage 정책 없음.
- test 장부만 초기화했다. 기존 장부는 덮어쓰지 않으며 실제 결제·HeyGen 호출은 연결하지 않았다.
- 기본 `rls_auto_enable()` 관리 함수의 public/anon/authenticated 실행 권한을 회수했다.
- 보안 검사 WARN/ERROR 없음. 두 장부의 'RLS 정책 없음' INFO는 서버만 접근하도록 한 설계다.
- 당시 Auth 공개 설정 조회에서 Google은 비활성화였다. 현재 Google 연동은 보류한다. 앱 서버 연결과 실제 파일 업로드·카카오 왕복 로그인은 미검증이다.

적용한 원격 migration: `launch_test_private_storage_and_ledger`, `restrict_auto_rls_event_trigger_execution`.
연결 도구는 카카오 제공자 설정 수정 기능을 제공하지 않는다. 비밀값은 아래 화면에서 직접 입력한다.

## 지금 필요한 사용자 입력

1. [카카오 제공자 설정](https://supabase.com/dashboard/project/cvwikgszywzlvadsvvvq/auth/providers)에서 Kakao를 선택한다.
2. naezzal4zzal 전용 카카오 REST API 키와 Kakao Login Client Secret을 입력하고 활성화·저장한다. **Allow users without an email**도 켠다.
   카카오 클라이언트의 승인된 리디렉션 URI에는 위 Supabase 콜백을 정확히 등록한다.
3. Vercel Preview에 아래 서버 키·DB 연결 URL을 입력한다. Production에는 적용하지 않는다.
4. 입력 뒤 코선생이 전용 테스트 주소와 복귀 URL을 확정하고 실제 로그인·저장을 검증한다.

서버 비밀값 입력 후 이어갈 일:

1. 앱 서버의 실제 DB 연결과 비공개 파일 업로드·다운로드·삭제를 확인한다.
2. 모의 결제·영상만 연결하고 가입 선물·장부 저장을 검증한다.
3. 실제 Preview URL이 확정된 뒤 정확한 OAuth 복귀 주소를 등록한다. 무제한 와일드카드는 사용하지 않는다.
4. 상혁님의 카카오 로그인 왕복을 확인한다.

초기화 파일은 `node scripts/prepareSupabaseTest.mjs`로 재생성할 수 있다.
이 명령 자체는 원격 연결이나 SQL 실행을 하지 않는다.

## 비밀값은 해당 설정 화면에 직접 입력

| 값 | 가져올 화면 | 입력할 화면·항목 |
|---|---|---|
| Supabase 서버 secret/service-role 키 | 해당 프로젝트 Settings → API Keys | Vercel naezzal4zzal-web → Settings → Environment Variables → **Preview Secret**, `SUPABASE_SERVICE_ROLE_KEY` |
| PostgreSQL 연결 URL(비밀번호 포함) | 해당 프로젝트 Connect → pooler 연결 | 같은 **Preview Secret**, `LAUNCH_DATABASE_URL` |
| 공개 키(publishable/anon) | 해당 프로젝트 API Keys | 같은 Preview의 `SUPABASE_ANON_KEY`; 공개용 키만 사용 |
| 카카오 Client ID·Client Secret | Kakao Developers → 전용 앱 → 플랫폼 키 → REST API 키·Kakao Login Client Secret | Supabase Authentication → Sign In / Providers → Kakao |

키·DB 비밀번호·카카오 Secret은 채팅이나 Git에 넣지 않는다.
카카오 전용 앱이 아직 없다면 SETUP.md의 생성·입력 순서를 따른다.
다른 앱의 OAuth 클라이언트나 인증 설정을 공용으로 바꾸지 않는다.

Vercel의 비밀값 입력을 요청할 때는 먼저 프로젝트/저장소 설정을 확인하고 정확한 변수 목록을 확정한다.
새 API 키와 기존 legacy service-role 키 중 실제 SDK에서 사용할 종류도 그 화면에서 확인한다.
모든 시크릿은 서버에만 두며, 기존 Vercel 운영 환경변수 전체를 내려받지 않는다.

## 2026-11-24 카카오 우선 전환

Google 설정 작업은 보류한다. 현재 로그인 구현은 Kakao이다.
Supabase Kakao에서 **Allow users without an email**을 반드시 활성화한다. account_email은 요청하지 않는다.
공개 Auth 설정을 다시 조회한 결과 Kakao=false, Google=false였다. 제공자 키 입력과 활성화는 아직 남아 있다.
실제 앱 서버 연결과 Kakao 제공자 설정은 아직 완료되지 않았다. 자세한 현행 절차는 SETUP.md를 따른다.
