import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { devVisionProxy } from "./scripts/devVisionProxy";
import { launchPreview } from "./scripts/launchPreview";
export default defineConfig(({mode}) => ({
  plugins: [react(), devVisionProxy(mode === 'launch' ? undefined : loadEnv(mode,process.cwd(),"").VISION_TEST_DEPLOYMENT), launchPreview(mode === 'launch')],
  define: mode === 'launch' ? { 'import.meta.env.VITE_LAUNCH_ENABLED': JSON.stringify('1') } : {},
  server: { watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
}));
