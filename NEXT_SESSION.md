# 이어서 작업할 내용

## 실제 Supabase Preview 연결 확인 — 2026-11-24

- 사용자가 입력한 두 Secret은 그대로 서버에 두고, 공개 키·독립 난수·mock/test 차단 플래그를 해당 브랜치 Preview에 등록했다.
- 배포 dpl_EUe6mc2F6MtUZwC2G3n2AQ6AnJ3m: https://naezzal4zzal-b0lcm7ksl-sanghyug-park-s-projects.vercel.app
- 실제 DB 트랜잭션·sb_secret 키로 두 비공개 버킷 저장/조회/삭제·공개 읽기 차단 성공. 무인증 검사 요청·기존 유료 영상·사진 분석 차단 확인.
- Kakao=true, Google=false. 실제 카카오 왕복과 가입5 중복 방지는 사용자 로그인이 남음. Supabase Redirect URLs에 위 원본의 /?auth=return 등록 필요. SUPABASE_TEST.md에 직접 확인 순서.
- api/launch의 previewIntegrationCheck는 Preview+test+mock+비밀값으로 보호된 합성 파일 검사 전용. 사용자 인증 우회나 회원 생성은 하지 않음. 출력에 키/사용자 정보 없음.
- 검사 결과는 artifacts/launch/supabase-preview-verification.json, 검사 전용 난수는 비공개 artifacts/launch/preview-check-secret. Supabase Secret/DB 연결 값은 로컬에 없음.

## 작업 브랜치 원격 등록 — 2026-11-24

- 사용자 요청으로 Vercel 연결 Git 저장소를 확인: Sanghyug/naezzal4zzal-web, 운영 브랜치 main.
- 카카오 로그인·신형 Supabase 키 지원과 테스트 프로젝트 준비를 codex/launch-credits-20261123 브랜치로 커밋·푸시한다. 운영 병합·운영 배포는 하지 않는다.
- Vercel의 Preview 환경변수 Git Branch 항목은 codex/launch-credits-20261123을 사용한다.

## 신형 Supabase 서버 키 — 2026-11-24

- 소유자가 Supabase Kakao Enabled·Allow users without an email·키·Redirect URI 저장 완료를 알림. Google 보류.
- Vercel 입력은 아직 전. 사용자 입력 확정: 테스트 Preview/브랜치에 SUPABASE_SERVICE_ROLE_KEY=sb_secret_…와 LAUNCH_DATABASE_URL만 Sensitive로 직접 등록.
- 나머지 공개 키·테스트 플래그·독립 난수 비밀값은 입력 완료 뒤 코선생이 서버에 설정. SETUP.md에 전체 목록 확정. 비밀키를 내려받거나 출력하지 말 것.
- server/launch/supabase.ts가 최신 키의 잘못된 Bearer 복사를 제거하고 실제 회원 JWT는 유지. Storage·Auth admin·getUser 요청을 가짜 키로 검증. 31개 자동 검사, launch 빌드·lint 통과.
- Preview APP_BASE_URL 생략 시 VERCEL_URL의 해당 HTTPS 배포 주소를 사용. 최종 주소의 /?auth=return을 Supabase에 허용하고 실제 소유자 로그인→가입5→비공개 파일 쓰기/읽기/삭제를 검사해야 함. 실제 외부 연결 검사는 아직 미완료.

## 카카오 로그인 우선 — 2026-11-24

- 사용자 지시로 Google 연동 보류. 로그인 버튼은 '카카오로 시작하기', Supabase OAuth provider=kakao, PKCE, 이메일 scope 없음.
- 카카오톡 인앱 로그인 차단 제거. OAuth 취소/실패 URL을 정리하고 편집 복원과 초대 visit 처리를 계속한다.
- 서버 getUser로 검증된 Supabase 회원 UUID에 크레딧 연결. 카카오 subject는 중복 가입 선물 방지 해시에만 사용. 이메일·사용자 수정 가능한 프로필은 권한 판단에 사용하지 않음.
- 기존 장부 초기화·회원 병합 없음. 기존 Google 회원의 유효한 세션만 호환 유지하고 신규 Google 가입은 받지 않음.
- SETUP.md가 현행 카카오 키 입력 안내. Supabase Kakao의 Allow users without an email 활성화 필요. 키 미입력으로 실제 카카오 계정·카카오톡 실기기 검증은 대기 중.

## Supabase 테스트 연결 — 2026-11-24 최신

- `naezzal4zzal-test` / `cvwikgszywzlvadsvvvq` / 서울 정상 가동 확인. Supabase 도구 연결됨.
- test 장부 두 개와 비공개 `launch-inputs`(JSON 4 MiB), `launch-results`(MP4 12 MiB)를 원격 생성했다.
- RLS와 일반 역할 권한 차단, 실제 공개 REST 접근 거부 확인. 기본 자동 RLS 함수의 불필요한 공개 실행 권한 회수. 보안 경고 없음(의도한 정책 없음 INFO 두 개).
- Google은 비활성 상태. 도구에 Auth 설정 수정 기능 없음. 사용자가 대시보드에 Google Client Secret, Vercel Preview에 서버 키·DB 연결 URL 직접 입력해야 함.
- `docs/launch/SUPABASE_TEST.md`에 정확한 입력 위치·후속 검사를 기록. 앱 서버 DB/Storage 실제 연결과 Google 왕복은 아직 미검증. 기존 운영 배포 변경 없음.

## 크레딧 출시 준비 — 2026-11-23 최신

- 작업 브랜치 `codex/launch-credits-20261123`. 기존 운영 주소는 변경하지 않았고 Git push도 하지 않았습니다.
- 승인 상품: 실사 B1 1 / 펜화 A3 3, 가입 5(선착순 100), 10크레딧 3,900원, 신규 친구 기본 GIF 검증+가입 후 초대자 2(한국 시간 월 5명).
- `docs/launch/REPORT.md`, `SETUP.md`, `OPERATIONS.md`에 구현·검증·한계·다음 사용자 작업을 기록했습니다.
- `npm run dev:launch`의 `http://127.0.0.1:5173/`은 SQLite에 지속되는 모의 체험입니다. 실제 돈·OpenAI·HeyGen 호출은 없습니다.
- 실제 Supabase·Google OAuth·토스 테스트 키·사업자·도메인 연결은 대기 중입니다. 다음은 naezzal4zzal 전용 Supabase 테스트 프로젝트 연결부터입니다.
- Vercel Preview 주소/배포 식별자는 비공개 `artifacts/launch/deployment.json`에 있습니다. 실제 외부 연결 전 로그인·결제·AI는 비활성화했습니다.
- Vercel Linux에서 합성 MP4의 실제 오디오 트랙 제거를 검증했습니다. 추가 유료 영상은 생성하지 않았습니다.
- 일반 `build`는 출시 화면 비활성화, `build:launch`는 출시 화면 활성화입니다. `vercel.launch.json`은 Pro 주기 작업과 운영 DB/계약을 갖춘 뒤에만 사용합니다.
- 작업 전부터 있던 `scripts/motion-i2v/` 미커밋 파일은 이번 출시 커밋에 섞지 않았습니다. 개인 사진/영상·DB·검사 자료는 artifacts 아래에 보존하며 Git/배포 제외입니다.

기준 위치: D:\\Codex\\naezzal4zzal-app. C:\\Users\\parki\\Documents\\ChatGPT\\naezzal4zzal 3\\app은 같은 폴더를 가리키는 Junction입니다.

2026-11-23 사용자가 공개 배포, 어제 실제 사진의 공개 앱·OpenAI 재전송 검사, 앱의 HeyGen 연동과 공유 보상 구현을 요청했습니다. 이전 배포 보류 지시는 대체되었습니다.

## 확인한 결과

- 기존 GIF 앱을 GitHub main 61254c3에 반영하고 Vercel 공개 배포를 완료했습니다.
- 공개 앱에서 사용자가 승인한 실제 사진으로 GPT-5.4 네 컷 추출, 4프레임 GIF, 브라우저 오류 없음을 확인했습니다. 결과는 Git·배포에서 제외되는 artifacts/production-verification에 있습니다.
- 공유 완료·취소·다운로드 처리, 편집 화면과 보관함의 보상 통합, 기존 버튼과 어울리는 AI 영상 제작 버튼을 구현했습니다.
- HeyGen 영상 서버 API, 별도 사진 전송 동의, 테스트 코드, 동일 요청 재시도, 상태 확인·복구, 영상 저장·공유를 구현했습니다.
- 자동 검사 10개와 브라우저 검사 8개, build·lint를 통과했습니다. 개인 사진이 없는 실제 MP4 검사 파일로 재생·다운로드·보관함 재열기·video/mp4 공유까지 확인했습니다. HeyGen 서버의 실제 생성 검사는 API 키 등록 후 진행해야 합니다.

## 비공개 자료

artifacts 아래의 실제 사진·GIF·영상 기록과 사무실 테스트 코드는 공개 저장소·배포에서 제외합니다. 어제 승인된 영상은 artifacts/video/production-ledger.json에 기록되어 있으므로 별도 시연을 위해 다시 생성하지 않습니다. 앱 연동 검사는 새 API 키로 실제 요청을 확인해야 합니다. HeyGen 키 값은 출력하거나 커밋하지 마세요.

## 남은 확인

- HeyGen API 키 등록 후 실제 서버 생성·완성 MP4 재생·다운로드·보관함 재열기 검사
- 새 기능의 공개 배포와 배포 후 확인
- Android·iPhone 실기기의 카카오톡 공유·파일 저장은 별도 실기기 확인 필요

## 키 등록과 추가 영상 옵션

2026-11-23 사용자가 직접 HEYGEN_API_KEY를 Production과 Preview에 Secret으로 등록한 것을 값 노출 없이 확인했습니다. 기본 인물 영상과 귀여운 동물 변신을 선택하도록 추가했으며, 두 가지 모두 같은 동작 순서를 요청하고 별도 생성의 차이는 안내합니다. 실제 API 영상 생성은 키 적용 배포 후 검사합니다.

## 실제 API 검사와 사용자 수정 요청

API 잔액 충전 뒤 기본·동물 영상 생성, 1024×768 재생, 약 5.26초 길이, 앱 파일 수신·다운로드·보관함 재열기를 확인했습니다. 실제 결과는 artifacts/video에 비공개로 있습니다. 기본 영상은 첫 결과와 한 차례 보완 결과 모두 후반 좌우 위치가 바뀌었으므로 위치 고정 성공으로 보고하지 마세요. 추가 기본 재생성은 하지 않았습니다.

사용자는 동물 결과가 탈을 쓴 것 같다며 거절했습니다. 완전한 강아지 몸과 강아지 얼굴에 인물별 눈매·윤곽·표정 느낌을 반영하는 방향으로 변경했습니다. 강아지 수정본만 별도로 한 번 생성해 확인합니다. 기존 탈 같은 결과를 승인된 결과로 취급하지 마세요.

## 최신 사용자 방향 변경

사용자는 동물·강아지 변신 방향을 중단하고 기본 실사 + 인물 특징을 유지한 2D 펜화 애니메이션 두 종류를 요청했습니다. 강아지 옵션을 2D 펜화로 교체합니다. 과거 동물 시험은 보존하되 다시 생성하지 마세요.

사용자는 2D 펜화 시안의 그림 느낌을 매우 마음에 들어 했습니다. 이 스타일을 유지합니다. 모바일 감상과 생성 비용 절감을 위해 실사·펜화 모두 480p로 변경했습니다. 이번 해상도 설정 변경에서는 새 유료 영상을 생성하지 않습니다.
