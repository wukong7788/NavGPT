import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import path from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: "manifest.json",
      watchMode: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
