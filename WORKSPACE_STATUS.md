# 작업 위치와 기존 연결 확인

확인일: 2026년 11월 22일

- 현재 작업 위치: D:\Codex\naezzal4zzal-app
- GitHub: https://github.com/Sanghyug/naezzal4zzal-web
- GitHub 최신 main: ca96fe0d4e100608d6bbff394248514d65178de1
- 작업 브랜치: codex/app-store-preparation
- 기존 C:\Users\parki\naezzal4zzal-app은 같은 커밋이며, 로컬 변경은 .gitignore, README.md, package.json, 이전 ZIP·덤프 제거입니다. src와 api는 GitHub와 같았습니다.
- 새 폴더는 최신 GitHub main을 복제한 뒤 이번 대화의 수정본을 적용했습니다. GitHub로 올리거나 배포하지 않았습니다.
- 기존 로컬 README는 PREVIOUS_PROJECT_NOTES.md에 보존했습니다. 과거 '유일한 작업 폴더' 지시는 현재 작업 경로를 뜻하지 않습니다.

## AI 연결

- 예전 로컬 폴더의 .env와 .env.local에서 OpenAI 키를 찾지 못했습니다. 값은 출력하지 않았습니다.
- 기존 .vercel/project.json의 naezzal4zzal-app 연결은 현재 계정에서 조회되지 않았습니다.
- 현재 계정의 naezzal4zzal-web 프로젝트는 찾았으나 vercel env ls 결과 등록된 환경변수가 없었습니다.
- 2026-10-29 정리 ZIP의 환경설정 파일에서도 OpenAI 키를 찾지 못했습니다. 백업을 변경하거나 비밀 값을 추출하지 않았습니다.
- 이는 과거에 AI가 연결되지 않았다는 증거가 아닙니다. 다른 계정·서버·과거 배포 설정은 아직 확인하지 못했습니다.
- GitHub 원본 서버는 gpt-4.1-mini를 요청합니다. 현재 수정본은 gpt-5.4-mini를 기본으로 준비했지만, 실제 유료 API 호출 및 인식 정확도 검증은 하지 않았습니다.

## 플랫폼

과거 작업 기록에는 Flutter에서 시작해 React/TypeScript 웹·앱인토스 프로젝트로 다시 만들었다고 적혀 있습니다. 현재 저장소에는 Flutter 소스가 없습니다. 현재 TypeScript 공통 코드에 Capacitor를 연결하여 android와 ios 프로젝트를 준비했습니다. 실제 Android APK·iOS 앱 서명과 실기기 검사는 아직 하지 않았습니다. toss:build 명령은 보존했습니다. .ait는 토스용 배포 묶음이며, 웹 서버 API를 포함하지 않습니다.

## 2026-11-23 실제 API 검사

사용자가 키를 다시 등록한 뒤 Production과 Preview 적용을 확인했습니다. 키 값은 가져오거나 출력하지 않았습니다. Production 배포는 실행하지 않았으며 Preview에서 검사했습니다. 처음 발견한 Vercel 공유 모듈 로딩 오류를 수정했습니다.

GPT-5.4 mini의 직접 좌표 결과는 실제 사진의 테두리와 충분히 맞지 않았습니다. 정사각형 좌표판, GPT-5.4, 사진의 색·명암 경계 보완을 조합하여 제공된 세로형 사진 한 장을 검사했습니다. 최신 검증 파일은 Git에서 제외된 artifacts/real-photo에 있으며, 실제 API 응답·추출 이미지·4프레임 GIF를 포함합니다. 전체 사진·얼굴을 새로 생성하거나 바꾸지 않고 원본 픽셀을 잘라 사용했습니다. 일반 정확도나 2×2·심한 원근 사진의 성공을 보장하는 검사는 아닙니다.

현재 컴퓨터의 미리보기는 .env.local의 VISION_TEST_DEPLOYMENT 설정과 기존 Vercel 로그인으로 Preview API를 호출합니다. OpenAI 키는 서버에만 있습니다. 이 개발용 연결은 휴대폰 배포용 서버 인증을 대신하지 않습니다.
