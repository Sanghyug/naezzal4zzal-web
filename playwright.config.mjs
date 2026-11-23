import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testIgnore:'**/launch.spec.mjs',timeout:45000,workers:1,use:{baseURL:'http://127.0.0.1:5174',viewport:{width:390,height:844},channel:'chrome'},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:true}});
