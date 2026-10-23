import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __MOVATE_SERVERLESS__: JSON.stringify(
      process.env.VERCEL === "1" || process.env.MOVATE_SERVERLESS === "1",
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          animation: ["motion/react"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    watch: { ignored: ["**/playwright-report/**", "**/test-results/**"] },
    proxy: { "/api": `http://127.0.0.1:${process.env.BACKEND_PORT || 8000}` },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
} as any);
