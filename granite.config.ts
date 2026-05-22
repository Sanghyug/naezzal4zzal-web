import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'naezzal4zzal',
  brand: {
  displayName: '내짤4짤',
  primaryColor: '#ff4f87',
  icon: 'https://static.toss.im/appsintoss/43365/1c051083-4cce-4796-9bff-f606057b7fba.png',
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