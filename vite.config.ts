import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "main-logo.png", "title-logo.png"],
      manifest: {
        name: "내짤4짤",
        short_name: "내짤4짤",
        description: "인생네컷 사진을 움직이는 짤로 바꿔주는 앱",
        theme_color: "#ff4f87",
        background_color: "#fff1f5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/favicon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/favicon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,gif,webp,wasm}"],
      },
    }),
  ],
});
