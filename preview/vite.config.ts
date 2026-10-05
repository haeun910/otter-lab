import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 1단계 확인용: 3D 연구소를 HTML 파일 하나로 묶어 링크로 공유해요.
export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { "@": resolve(__dirname, "..") } },
  build: { outDir: resolve(__dirname, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
