# 내짤4짤

인생네컷 사진을 분리하고 GIF로 저장·공유하는 React/TypeScript 앱입니다.
Flutter로 시작한 앱을 웹·앱인토스용으로 다시 만든 프로젝트입니다.

## 작업 기준

- 유일한 로컬 작업 폴더: `C:\Users\parki\naezzal4zzal-app`
- GitHub: https://github.com/Sanghyug/naezzal4zzal-web
- 정리 기준 커밋: `ca96fe0d4e100608d6bbff394248514d65178de1` (2026-06-12)
- `src/`: 웹·앱인토스 공용 화면과 사진/GIF 처리
- `api/extract-cells.ts`: Vercel에서 실행하는 AI API
- `granite.config.ts`: 앱인토스 설정
- `vercel.json`: 웹 및 API 배포 설정

## 실행과 빌드

```sh
npm ci
npm run dev
npm run build
npm run toss:build
```

`npm run build`는 웹 빌드와 TypeScript 검사를 수행합니다.
`npm run toss:build`는 앱인토스 `.ait` 패키지를 생성합니다.
일반 Vite 개발 서버는 `/api/extract-cells` 서버 함수를 실행하지 않습니다.
AI를 포함한 개발은 Vercel 개발 환경 또는 배포된 API가 필요합니다.

## AI API 및 앱인토스 주의사항

API 서버 환경변수 `OPENAI_API_KEY`가 필요합니다. 키는 클라이언트에 넣지 않습니다.
현재 프런트엔드는 같은 출처의 `/api/extract-cells`를 호출하며,
API는 `{ layout, strip }` 형식으로 결과를 반환합니다.
웹에서는 프런트엔드와 API를 함께 Vercel에 배포하는 구성입니다.

앱인토스 `.ait`에는 Vercel 서버 함수가 포함되지 않습니다.
토스 재배포 전에는 별도로 배포된 API의 절대 주소로 연결하고 실제 기기에서 검증해야 합니다.
과거 독립 AI 서버는 `{ cells }` 형식이므로 주소만 바꿔 재사용하면 호환되지 않습니다.
2026-10-29 정리에서는 API 동작을 변경하거나 외부 배포하지 않았습니다.
토스 콘솔은 로그인 화면까지만 접근했으므로 실제 업로드 빌드와의 일치는 미확인입니다.

## 2026-10-29 정리와 복구

5월의 구버전 작업 폴더 5개와 그 안의 중첩 복사본을 정리하고 이 프로젝트를 기준으로 남겼습니다.
이 프로젝트 안의 이전 소스 ZIP과 `project_dump.txt`도 복구 ZIP으로 보존한 뒤 제거했습니다.
현재 소스, AI 서버 코드, 이미지, 환경설정, Vercel 연결 정보와 Git 이력은 보존했습니다.
최신 GitHub 변경은 fast-forward로 반영했습니다.

복구 파일:
`C:\Users\parki\Documents\ChatGPT\naezzal4zzal 2\recovery-before-cleanup-20261029.zip`

목록과 SHA-256:
`C:\Users\parki\Documents\ChatGPT\naezzal4zzal 2\recovery-manifest.json`

ZIP의 모든 605개 파일을 원본과 SHA-256으로 대조했습니다.
재설치 가능한 `node_modules`와 재생성 가능한 `dist`는 백업에서 제외했습니다.
백업에는 로컬 환경설정도 들어 있으므로 외부에 공개하거나 Git에 올리지 마세요.
Flutter 프로젝트는 지정된 두 경로에서 발견되지 않았으며, 다른 위치는 정리하지 않았습니다.
