import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "public"),
  server: {
    port: 5173,
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
