import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone config: build and run Crystal Vault with plain Vite, outside Enter.
//
// It skips Enter's private Vite plugin and swaps Enter's analytics SDK for the
// no-op shim in standalone/analytics-stub.ts. The default vite.config.ts is left
// alone so Enter's own preview and build keep working unchanged.
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@enter-pro/analytics-sdk": path.resolve(__dirname, "./standalone/analytics-stub.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "/",
  build: {
    outDir: "dist",
  },
});
