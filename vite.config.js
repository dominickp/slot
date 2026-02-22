import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  root: resolve(__dirname, "public"),
  server: {
    port: 5173,
    host: "0.0.0.0",
    open: true,
    hmr: true,
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
