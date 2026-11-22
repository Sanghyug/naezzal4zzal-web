import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { devVisionProxy } from "./scripts/devVisionProxy";
export default defineConfig(({mode}) => ({
  plugins: [react(), devVisionProxy(loadEnv(mode,process.cwd(),"").VISION_TEST_DEPLOYMENT)],
}));
