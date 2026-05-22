import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'naezzal4zzal',
  brand: {
    displayName: '내짤4짤',
    primaryColor: '#ff4f87',
    icon: '콘솔에서 앱 로고 아이콘 우클릭 후 복사한 이미지 URL',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host 0.0.0.0',
      build: 'tsc -b && vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
  webViewProps: {
    type: 'partner',
  },
});