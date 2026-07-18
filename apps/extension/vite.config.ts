import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { inpage: resolve(__dirname, "src/inpage.ts"), content: resolve(__dirname, "src/content.ts"), serviceWorker: resolve(__dirname, "src/service-worker.ts"), sidepanel: resolve(__dirname, "sidepanel.html"), popup: resolve(__dirname, "popup.html"), onboarding: resolve(__dirname, "onboarding.html") },
      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" }
    }
  }
});
