import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// 미리보기: 연구소를 HTML 파일 하나로 묶어 링크로 공유해요.
export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), viteSingleFile()],
  // 미리보기 파일은 서버·로그인 없이 돌아가요
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined",
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": "undefined",
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "undefined",
    "process.env.NEXT_PUBLIC_LOGIN_GOOGLE": "undefined",
  },
  resolve: { alias: { "@": resolve(__dirname, "..") } },
  build: { outDir: resolve(__dirname, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
