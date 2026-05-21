import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'naezzal-4-zzal',
  brand: {
    displayName: '내짤4짤',
    primaryColor: '#ff4f87',
    icon: './public/favicon-192.png',
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
});